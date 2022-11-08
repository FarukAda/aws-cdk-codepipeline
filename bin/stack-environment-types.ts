import { StackProps } from 'aws-cdk-lib';

export interface IAwsCdkCodepipelineStackProps extends StackProps {
  stackToDeploy: string,
  template: string,
  github: {
    owner: string,
    repo: string,
    branch: string,
  },
  permissions: string[]
}