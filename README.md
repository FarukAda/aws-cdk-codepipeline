# **AWS CDK Codepipeline**

[![CDK Version](https://img.shields.io/badge/CDK-2.39.1-orange)](https://docs.aws.amazon.com/cdk/api/versions.html)
[![TypeScript Version](https://img.shields.io/badge/TypeScript-3.9.7-blue)](https://www.typescriptlang.org/download)

## **Content:**

* [Description](#description)
* [Get Started](#get-started)
  * [Useful commands](#useful-commands)

## **Description:**

    The is an example project build with the AWS Cloud Development Kit (CDK) using TypeScript.
    The project contains an AWS CodePipeline for deploying a CDK Stack containing a Lambda function. 
    The project also contains:
    - Jest for unit testing
    - ESLint for static code analysis
    - GitHub Actions CI/CD workflows 

    1.The pipeline pull the source code from GitHub.
    2.Builds the Cloudformation template.
    2.Build the Lambda code.
    3.Deploys Infrastructure and Lambda into AWS account.

    After running the build stages a Codestar Notification will be generated.
    The notification gets send through SNS for success and failure.
    
    This project was made by @FarukAda.

# **Get Started:**

* Clone this repository.
* Adjust configuration in `bin/stack-config.ts`.
  * Configure `github` owner, repo and branch.
  * Create a GitHub Oauth token and store it in AWS secrets manager.
  * Add secret name in GitHub configuration.
  * Configure `codebuild` with stackname and lambda handler file.
* Execute `npm run test` to check if configuration is still valid.
* Execute `cdk deploy` or push to GitHub and execute manual workflow.

## **Useful commands:**

| Command  | Description    |
|----------|----------------|
|`cdk bootstrap`|bootstrap aws for cdk on first time using cdk|
|`npm run build`|compile typescript to js|
|`npm run test`|perform the jest unit tests|
|`npm run lint`|perform static analyses on code|
|`cdk diff`|compare deployed stack with current state|
|`cdk synth`|emits the synthesized CloudFormation template|
|`cdk deploy`| deploy this stack to your default AWS account/region|
