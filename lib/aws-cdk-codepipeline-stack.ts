/* eslint-disable max-lines */
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as notifications from 'aws-cdk-lib/aws-codestarnotifications';
import * as sns from 'aws-cdk-lib/aws-sns';

import { IAwsCdkCodepipelineStackProps } from '../bin/stack-environment-types';

export class AwsCdkCodepipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: IAwsCdkCodepipelineStackProps) {
    super(scope, id, props);

    /** IAM */
    const role = new iam.Role(this, 'role', {
      roleName: 'codepipeline-role',
      description: 'IAM role for AWS Codepipeline',
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('cloudformation.amazonaws.com'),
        new iam.ServicePrincipal('codebuild.amazonaws.com'),
        new iam.ServicePrincipal('codepipeline.amazonaws.com'),
      ),
    });
    role.addToPolicy(new iam.PolicyStatement({
      resources: ['*'],
      actions: props.permissions,
    }));

    /** KMS */
    const key = new kms.Key(this, 'key', {
      alias: 'alias/codepipeline-key',
      description: 'KMS key for AWS Codepipeline',
    });
    key.grantEncryptDecrypt(role);

    /** Codebuild */
    const buildSpecObject = {
      version: '0.2',
      phases: {
        install: {
          commands: ['npm ci'],
        },
        build: {
          commands: ['npm run build'],
        },
        post_build: {
          commands: [
            'npm run lint',
            'npm run test',
            `npx cdk synth ${props.stackToDeploy} -o dist`,
          ],
        },
      },
      artifacts: {
        'base-directory': 'dist',
        files: [props.template],
      },
    };

    const buildSpec = new codebuild.PipelineProject(this, 'buildSpec', {
      role,
      buildSpec: codebuild.BuildSpec.fromObject(buildSpecObject),
      encryptionKey: key,
    });

    /** Codepipeline Artifacts */
    const output = new codepipeline.Artifact();
    const buildOutput = new codepipeline.Artifact('buildOutput');

    /** Codepipeline Actions */
    const githubSourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: 'Checkout_Code',
      output,
      owner: props.github.owner,
      repo: props.github.repo,
      branch: props.github.branch,
      oauthToken: cdk.SecretValue.secretsManager('my-github-token'),
      trigger: codepipeline_actions.GitHubTrigger.WEBHOOK,
    });

    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'Build',
      role,
      input: output,
      project: buildSpec,
      outputs: [buildOutput],
    });

    const approvalAction = new codepipeline_actions.ManualApprovalAction({
      actionName: 'Approval',
      role,
    });

    const deployAction = new codepipeline_actions.CloudFormationCreateUpdateStackAction({
      actionName: 'Deploy',
      role,
      deploymentRole: role,
      adminPermissions: false,
      stackName: props.stackToDeploy,
      templatePath: buildOutput.atPath(props.template),
    });

    /** Codepipeline */
    const pipeline = new codepipeline.Pipeline(this, 'codepipeline', {
      pipelineName: 'cdk-codepipeline',
      crossAccountKeys: false,
      role,
      stages: [
        {
          stageName: 'Source',
          actions: [githubSourceAction],
        },
        {
          stageName: 'Build',
          actions: [buildAction],
        },
        {
          stageName: 'Approval',
          actions: [approvalAction],
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
      topicName: 'codepipeline-topic',
    });
    topic.grantPublish(role);

    new notifications.NotificationRule(this, 'notifications', {
      source: pipeline,
      events: [
        'codebuild-project-build-state-succeeded',
        'codebuild-project-build-state-failed',
      ],
      targets: [topic],
    });
  }
}
