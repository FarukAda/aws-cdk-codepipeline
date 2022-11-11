/* eslint-disable max-statements, max-lines */
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as notifications from 'aws-cdk-lib/aws-codestarnotifications';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_sub from 'aws-cdk-lib/aws-sns-subscriptions';

import { IAwsCdkCodepipelineStackProps } from '../bin/stack-environment-types';

export class AwsCdkCodepipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: IAwsCdkCodepipelineStackProps) {
    super(scope, id, props);

    /**
     * IAM Role used by Codepipeline and assumed by related components.
     */
    const role = new iam.Role(this, 'role', {
      roleName: props.role.name,
      description: props.role.description,
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('cloudformation.amazonaws.com'),
        new iam.ServicePrincipal('codebuild.amazonaws.com'),
        new iam.ServicePrincipal('codepipeline.amazonaws.com'),
      ),
    });
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName(props.role.managedPolicy));

    /** KMS Key used for S3 bucket in Codepipeline*/
    const key = new kms.Key(this, 'key', { description: props.keyDescription, removalPolicy: cdk.RemovalPolicy.DESTROY });
    key.grantEncryptDecrypt(role);

    /** GitHub Token */
    const githubToken = secretsmanager.Secret.fromSecretNameV2(this, 'githubSecret', props.github.tokenSecretName);
    githubToken.grantRead(role);

    /** Codebuild for building template and lambda code*/
    const getBuildSpec = (name:string, commds: string[], dir: string, files: string[]) => {
      return new codebuild.PipelineProject(this, name,
        {
          projectName: name,
          role,
          encryptionKey: key,
          environment: { buildImage: codebuild.LinuxBuildImage.STANDARD_6_0 },
          buildSpec: codebuild.BuildSpec.fromObject({
            version: '0.2',
            phases: {
              install: {
                commands: ['npm ci'],
              },
              build: {
                commands: ['npm run build'],
              },
              post_build: {
                commands: commds,
              },
            },
            artifacts: {
              'base-directory': dir,
              files: files,
            },
          }),
        },
      );
    };
    const buildTemplate = getBuildSpec(
      props.codebuild.templateProject,
      [
        'npm run test',
        `npx cdk synth ${props.codebuild.targetStack} -o dist`,
      ],
      'dist',
      [`${props.codebuild.targetStack}.template.json`],
    );
    const buildLambda = getBuildSpec(
      props.codebuild.lambdaProject,
      [],
      'dist/src',
      [props.codebuild.targetLambda],
    );

    /** Codepipeline Artifacts and S3 bucket used in Codepipeline*/
    const source = new codepipeline.Artifact();
    const templateOutput = new codepipeline.Artifact('templateOutput');
    const lambdaOutput = new codepipeline.Artifact('lambdaOutput');
    const artifactBucket = new s3.Bucket(this, 'bucket', {
      bucketName: props.bucketName,
      encryptionKey: key,
      encryption: cdk.aws_s3.BucketEncryption.KMS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    artifactBucket.grantReadWrite(role);

    /** Codepipeline Actions */
    const githubSourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: 'Checking_Out_Source_Code',
      output: source,
      owner: props.github.owner,
      repo: props.github.repo,
      branch: props.github.branch,
      oauthToken: githubToken.secretValueFromJson('secret'),
      trigger: codepipeline_actions.GitHubTrigger.WEBHOOK,
      runOrder: 1,
    });

    const getBuildAction = (actionName:string, project: codebuild.IProject, build: codepipeline.Artifact ) => {
      return new codepipeline_actions.CodeBuildAction({
        actionName,
        role,
        input: source,
        project,
        outputs: [build],
        runOrder: 2,
      });
    };
    const buildTemplateAction = getBuildAction('Building_Template', buildTemplate, templateOutput);
    const buildLambdaAction = getBuildAction('Building_Lambda', buildLambda, lambdaOutput);

    const deployAction = new codepipeline_actions.CloudFormationCreateUpdateStackAction({
      actionName: 'Deploying_Stack',
      role,
      deploymentRole: role,
      adminPermissions: true,
      stackName: props.codebuild.targetStack,
      templatePath: templateOutput.atPath(`${props.codebuild.targetStack}.template.json`),
      extraInputs: [lambdaOutput],
      cfnCapabilities: [
        cdk.CfnCapabilities.NAMED_IAM,
        cdk.CfnCapabilities.AUTO_EXPAND,
      ],
      parameterOverrides: {
        bucketName: lambdaOutput.bucketName,
        bucketKey: lambdaOutput.objectKey,
      },
      runOrder: 3,
    });

    /** Codepipeline */
    const pipeline = new codepipeline.Pipeline(this, 'codepipeline', {
      pipelineName: props.pipelineName,
      role,
      artifactBucket,
      stages: [
        {
          stageName: 'Source',
          actions: [githubSourceAction],
        },
        {
          stageName: 'Build',
          actions: [buildTemplateAction, buildLambdaAction],
        },
        {
          stageName: 'Deploy',
          actions: [deployAction],
        },
      ],
    });
    pipeline.addToRolePolicy(new iam.PolicyStatement({
      actions: ['sts:AssumeRole'],
      resources: [role.roleArn],
    }));

    /** Notifications */
    const topic = new sns.Topic(this, 'topic', {
      topicName: props.topic.name,
    });
    topic.grantPublish(role);
    props.topic.subEmails.map(email => {
      const subscription = new sns_sub.EmailSubscription(email);
      topic.addSubscription(subscription);
    });

    [
      { source: buildTemplate, name: 'template' },
      { source: buildLambda, name: 'lambda' },
    ].forEach(build => {
      return new notifications.NotificationRule(
        this,
        `${build.name}-notifications`,
        {
          notificationRuleName: `${build.name}-notifications`,
          source: build.source,
          events: [
            'codebuild-project-build-state-succeeded',
            'codebuild-project-build-state-failed',
          ],
          targets: [topic],
        },
      );
    });
  }
}
