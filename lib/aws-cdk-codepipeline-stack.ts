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

    /** IAM */
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

    /** KMS */
    const key = new kms.Key(this, 'key', {
      description: props.keyDescription,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    key.grantEncryptDecrypt(role);

    /** Codebuild */
    const buildSpec = new codebuild.PipelineProject(this, 'buildSpec', {
      projectName: props.projectName,
      role,
      buildSpec: codebuild.BuildSpec.fromObject(props.buildSpecObject),
      encryptionKey: key,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
      },
    });

    /** Codepipeline Artifacts and S3 */
    const output = new codepipeline.Artifact();
    const buildOutput = new codepipeline.Artifact('buildOutput');
    const artifactBucket = new s3.Bucket(this, 'bucket', {
      bucketName: props.bucketName,
      encryptionKey: key,
      encryption: cdk.aws_s3.BucketEncryption.KMS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    artifactBucket.grantReadWrite(role);

    /** GitHub Token */
    const githubToken = secretsmanager.Secret.fromSecretNameV2(this, 'githubSecret', props.github.tokenSecretName);
    githubToken.grantRead(role);

    /** Codepipeline Actions */
    const githubSourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: 'Checking_Out_GitHub',
      output,
      owner: props.github.owner,
      repo: props.github.repo,
      branch: props.github.branch,
      oauthToken: githubToken.secretValueFromJson('secret'),
      trigger: codepipeline_actions.GitHubTrigger.WEBHOOK,
    });
    const buildAndDeployAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'Building_And_Deploying_Stack',
      role,
      input: output,
      project: buildSpec,
      outputs: [buildOutput],
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
          stageName: 'Build_And_Deploy',
          actions: [buildAndDeployAction],
        },
      ],
    });
    pipeline.addToRolePolicy(new iam.PolicyStatement({
      actions: ['sts:AssumeRole'],
      resources: [role.roleArn],
    }));

    /** Notifications */
    const topic = new sns.Topic(this, 'topic', {
      topicName: props.topicName,
    });
    topic.grantPublish(role);
    props.subEmails.map(email => {
      const subscription = new sns_sub.EmailSubscription(email);
      topic.addSubscription(subscription);
    });
    new notifications.NotificationRule(this, 'notifications', {
      source: buildSpec,
      events: [
        'codebuild-project-build-state-succeeded',
        'codebuild-project-build-state-failed',
      ],
      targets: [topic],
    });
  }
}
