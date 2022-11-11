import { StackProps } from 'aws-cdk-lib';

export interface IAwsCdkCodepipelineStackProps extends StackProps {
  deployStackName: string,
  template: string,
  projectName: string,
  pipelineName: string,
  keyDescription: string,
  bucketName: string,
  topicName: string,
  subEmails: string[],
  role: {
    name: string,
    description: string,
    managedPolicy: string,
  },
  github: {
    tokenSecretName: string,
    owner: string,
    repo: string,
    branch: string,
  },
  buildSpecObject: object
}