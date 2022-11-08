# AWS CDK Codepipeline

This is an example project for CDK development with TypeScript.
The project contains an AWS Codepipeline for deploying Cloudformation templates.

The `lib/aws-cdk-codepipeline-stack.ts` contains the AWS infrastructure.
The `bin/stack-config.ts` contains the stack environment variables.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
