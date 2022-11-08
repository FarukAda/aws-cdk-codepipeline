import { IAwsCdkCodepipelineStackProps } from './stack-environment-types';

const environmentConfig: IAwsCdkCodepipelineStackProps = {
  tags: {
    Developer: 'Faruk Ada',
    Application: 'AwsCdkCodepipeline',
  },
  stackToDeploy: 'MyFirstCdkStack',
  template: 'MyFirstCdkStack.template.json',
  github: {
    owner: 'CodingWithFaruci',
    repo: 'my-first-cdk',
    branch: 'main',
  },
  permissions: [
    'lambda:*',
    'codedeploy:*',
    'secretsmanager:*',
    'kms:Decrypt',
    'kms:DescribeKey',
    'cloudformation:*',
    'iam:GetRole',
    'iam:CreateRole',
    'iam:AttachRolePolicy',
  ]
};

export default environmentConfig;