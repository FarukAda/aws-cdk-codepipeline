import { IAwsCdkCodepipelineStackProps } from './stack-environment-types';

const environmentConfig: IAwsCdkCodepipelineStackProps = {
  tags: {
    Developer: 'Faruk Ada',
    Application: 'AwsCdkCodepipeline',
  },
  deployStackName: 'MyFirstCdkStack',
  template: 'MyFirstCdkStack.template.json',
  projectName: 'CDK-Deployment',
  pipelineName: 'DeploymentPipeline',
  keyDescription: 'KMS key used for Codepipeline',
  bucketName:'coding-with-faruci-codepipeline-bucket',
  topicName: 'codepipeline-topic',
  subEmails: [],
  role: {
    name: 'codepipeline-role',
    description: 'IAM role for Codepipeline',
    managedPolicy: 'AdministratorAccess',
  },
  github: {
    tokenSecretName: 'my-github-token',
    owner: 'FarukAda',
    repo: 'my-first-cdk',
    branch: 'main',
  },
  buildSpecObject: {
    version: '0.2',
    phases: {
      install: {
        commands: ['npm ci'],
      },
      build: {
        commands: [
          'npm run build',
          'npm run test',
        ],
      },
      post_build: {
        commands: ['npm run deploy'],
      },
    },
  },
};

export default environmentConfig;