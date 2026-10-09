---
id: aws-cloud-practitioner
name: AWS Cloud Practitioner
description: AWS Certified Cloud Practitioner (CLF-C02): cloud concepts, security, services, and billing and support.
category: custom
source: AWS Certified Cloud Practitioner (CLF-C02) Exam Guide, aws.amazon.com; domains and task statements as published, knowledge and skills condensed by hand.
verified: false
version: 1
---

# Domain 1: Cloud Concepts

## Benefits of the AWS Cloud

- Value proposition of the AWS Cloud
- Economies of scale
- Global infrastructure: speed of deployment and global reach
- High availability, elasticity and agility

## Design principles

- The AWS Well-Architected Framework
- The six pillars: operational excellence, security, reliability, performance, cost and sustainability
- Differences between the pillars

## Migration to the AWS Cloud

- Cloud adoption strategies
- Resources for the migration journey
- The AWS Cloud Adoption Framework (AWS CAF) and its benefits
- Migration strategies: database replication, AWS Snowball

## Cloud economics

- Fixed and variable costs
- Costs of on-premises environments
- Licensing: bring your own licence and included licences
- Rightsizing
- Benefits of automation: AWS CloudFormation
- Managed services: Amazon RDS, ECS, EKS and DynamoDB

# Domain 2: Security and Compliance

## Shared responsibility model

- Components of the shared responsibility model
- Customer, AWS and shared responsibilities
- How responsibilities shift between services: RDS, Lambda, EC2

## Security, governance and compliance

- Compliance information: AWS Artifact
- Compliance needs by location and industry
- Securing resources: Amazon Inspector, Security Hub, GuardDuty, AWS Shield
- Encryption in transit and at rest
- Monitoring and auditing: CloudWatch, CloudTrail, Audit Manager, AWS Config
- Where to find security logs

## Access management

- AWS Identity and Access Management (IAM): users, groups and policies
- Protecting the root user and root-only tasks
- Principle of least privilege
- AWS IAM Identity Center
- Access keys, password policies and credential storage: Secrets Manager, Systems Manager
- Authentication: MFA, cross-account roles, federated identity

## Security components and resources

- Security groups, network ACLs and AWS WAF
- Third-party security products in AWS Marketplace
- AWS Knowledge Center, Security Center and Security Blog
- AWS Trusted Advisor for security checks

# Domain 3: Cloud Technology and Services

## Deploying and operating

- Programmatic access: APIs, SDKs and the CLI
- The AWS Management Console
- Infrastructure as code
- One-time operations and repeatable processes
- Cloud, hybrid and on-premises deployment models
- Connectivity: AWS VPN, Direct Connect, public internet

## Global infrastructure

- Regions, Availability Zones and edge locations
- High availability with multiple Availability Zones
- When to use multiple Regions: disaster recovery, latency, data sovereignty
- Edge services: CloudFront and Global Accelerator
- Wavelength Zones and Local Zones

## Compute

- EC2 instance types
- Containers: Amazon ECS and EKS
- Serverless compute: AWS Fargate and Lambda
- Auto scaling and elasticity
- Load balancers

## Databases

- EC2-hosted and AWS managed databases
- Relational databases: Amazon RDS and Aurora
- NoSQL databases: DynamoDB
- In-memory databases
- Migration: AWS DMS and Schema Conversion Tool

## Networking

- VPC components: subnets and gateways
- VPC security: network ACLs and security groups
- Amazon Route 53
- Connectivity to AWS: VPN and Direct Connect

## Storage

- Object storage and Amazon S3 storage classes
- Block storage: Amazon EBS and instance store
- File services: Amazon EFS and FSx
- Cached file systems: AWS Storage Gateway
- Lifecycle policies
- AWS Backup

## AI/ML and analytics

- AI/ML services: SageMaker, Lex, Kendra
- Analytics: Athena, Kinesis, Glue, QuickSight

## Other service categories

- Application integration: EventBridge, SNS, SQS
- Business applications: Amazon Connect and SES
- Customer engagement: AWS Activate, AWS IQ, Managed Services, AWS Support
- Developer tools: CodeBuild, CodeDeploy, CodePipeline, CloudShell, X-Ray
- End-user computing: AppStream 2.0 and WorkSpaces
- Front-end web and mobile: Amplify and AppSync
- IoT: IoT Core and IoT Greengrass

# Domain 4: Billing, Pricing and Support

## Pricing models

- On-Demand, Reserved and Spot Instances
- Savings Plans, Dedicated Hosts, Dedicated Instances, Capacity Reservations
- Reserved Instance flexibility and behaviour in AWS Organizations
- Data transfer charges: inbound, outbound, between Regions
- Storage options and tiers

## Billing, budget and cost management

- AWS Budgets, Cost Explorer and Billing Conductor
- AWS Pricing Calculator
- AWS Organizations consolidated billing
- Cost allocation tags and the Cost and Usage Report

## Technical resources and support

- Whitepapers, blogs and documentation
- Prescriptive Guidance, Knowledge Center and re:Post
- Support plans: Developer, Business, Enterprise On-Ramp, Enterprise
- AWS Support Center
- Trusted Advisor, Health Dashboard and Health API
- AWS Trust and Safety team
- AWS Partner Network and AWS Marketplace
