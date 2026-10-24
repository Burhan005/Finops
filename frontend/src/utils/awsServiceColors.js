/**
 * AWS Official Architecture Service Color System
 * Sourced directly from official AWS Architecture Icon Guidelines:
 * 
 * Category Colors:
 * - Compute (EC2, Lambda, ECS, EKS, Fargate): #FF9900 (AWS Compute Orange)
 * - Storage (S3, EBS, EFS, Glacier, FSx): #3F8624 (AWS Storage Green)
 * - Database (RDS, DynamoDB, Aurora, ElastiCache, Redshift): #2E73B8 (AWS Database Blue)
 * - Networking & Content Delivery (CloudFront, VPC, Route 53, ELB): #8C4FFF (AWS Networking Purple)
 * - Security, Identity & Compliance (IAM, KMS, WAF, Shield, GuardDuty): #DD344C (AWS Security Red)
 * - Management & Governance (CloudWatch, CloudTrail, Config, SSM): #E05243 (AWS Management Coral)
 * - Analytics & Big Data (Athena, EMR, Glue, Kinesis, OpenSearch): #763CD4 (AWS Analytics Violet)
 * - Application Integration (SQS, SNS, EventBridge, Step Functions): #E7157B (AWS Integration Magenta)
 * - Artificial Intelligence & ML (SageMaker, Bedrock): #00A4A6 (AWS ML Teal)
 * - Developer Tools (CodeBuild, CodePipeline): #0073BB (AWS Developer Blue)
 * - Other / Neutral: #64748B (Cloud Slate)
 */

export const AWS_CATEGORY_COLORS = {
  compute: '#FF9900',
  storage: '#3F8624',
  database: '#2E73B8',
  networking: '#8C4FFF',
  security: '#DD344C',
  management: '#E05243',
  analytics: '#763CD4',
  integration: '#E7157B',
  ml: '#00A4A6',
  developer: '#0073BB',
  neutral: '#64748B'
};

/**
 * Resolves the authentic official AWS architecture color for any AWS service string.
 * Supports canonical names (e.g. "Amazon Simple Storage Service"), product codes ("AmazonEC2"),
 * and common abbreviations ("S3", "RDS", "EBS", "CloudFront").
 * 
 * @param {string} serviceName 
 * @returns {string} Hex color string
 */
export function getAwsServiceColor(serviceName = '') {
  if (!serviceName) return AWS_CATEGORY_COLORS.neutral;

  const norm = serviceName.toLowerCase().replace(/[\s\-_/.]/g, '');

  // 1. Storage Services (AWS Storage Green #3F8624)
  if (
    norm.includes('s3') ||
    norm.includes('simplestorage') ||
    norm.includes('glacier') ||
    norm.includes('ebs') ||
    norm.includes('elasticblockstore') ||
    norm.includes('efs') ||
    norm.includes('fsx') ||
    norm.includes('storage') ||
    norm.includes('backup')
  ) {
    return AWS_CATEGORY_COLORS.storage;
  }

  // 2. Database Services (AWS Database Blue #2E73B8)
  if (
    norm.includes('rds') ||
    norm.includes('relationaldatabase') ||
    norm.includes('aurora') ||
    norm.includes('dynamodb') ||
    norm.includes('elasticache') ||
    norm.includes('redshift') ||
    norm.includes('neptune') ||
    norm.includes('documentdb') ||
    norm.includes('timestream') ||
    norm.includes('keyspaces') ||
    norm.includes('database')
  ) {
    return AWS_CATEGORY_COLORS.database;
  }

  // 3. Networking & Content Delivery (AWS Networking Purple #8C4FFF)
  if (
    norm.includes('cloudfront') ||
    norm.includes('vpc') ||
    norm.includes('virtualprivatecloud') ||
    norm.includes('route53') ||
    norm.includes('elb') ||
    norm.includes('elasticloadbalancing') ||
    norm.includes('loadbalancing') ||
    norm.includes('directconnect') ||
    norm.includes('transitgateway') ||
    norm.includes('apigateway') ||
    norm.includes('network')
  ) {
    return AWS_CATEGORY_COLORS.networking;
  }

  // 4. Security, Identity & Compliance (AWS Security Crimson #DD344C)
  if (
    norm.includes('kms') ||
    norm.includes('keymanagement') ||
    norm.includes('iam') ||
    norm.includes('identityandaccess') ||
    norm.includes('waf') ||
    norm.includes('shield') ||
    norm.includes('guardduty') ||
    norm.includes('securityhub') ||
    norm.includes('secretsmanager') ||
    norm.includes('inspector') ||
    norm.includes('cognito') ||
    norm.includes('certificatemanager') ||
    norm.includes('acm') ||
    norm.includes('security')
  ) {
    return AWS_CATEGORY_COLORS.security;
  }

  // 5. Management & Governance (AWS Management Coral #E05243)
  if (
    norm.includes('cloudwatch') ||
    norm.includes('cloudtrail') ||
    norm.includes('config') ||
    norm.includes('systemsmanager') ||
    norm.includes('ssm') ||
    norm.includes('cloudformation') ||
    norm.includes('budgets') ||
    norm.includes('costexplorer') ||
    norm.includes('governance')
  ) {
    return AWS_CATEGORY_COLORS.management;
  }

  // 6. Analytics & Big Data (AWS Analytics Violet #763CD4)
  if (
    norm.includes('athena') ||
    norm.includes('glue') ||
    norm.includes('kinesis') ||
    norm.includes('opensearch') ||
    norm.includes('elasticsearch') ||
    norm.includes('emr') ||
    norm.includes('quicksight') ||
    norm.includes('msk') ||
    norm.includes('analytics')
  ) {
    return AWS_CATEGORY_COLORS.analytics;
  }

  // 7. Application Integration (AWS Integration Magenta #E7157B)
  if (
    norm.includes('sqs') ||
    norm.includes('simplequeue') ||
    norm.includes('sns') ||
    norm.includes('simplenotification') ||
    norm.includes('eventbridge') ||
    norm.includes('stepfunctions') ||
    norm.includes('mq') ||
    norm.includes('appsync')
  ) {
    return AWS_CATEGORY_COLORS.integration;
  }

  // 8. AI & Machine Learning (AWS ML Teal #00A4A6)
  if (
    norm.includes('sagemaker') ||
    norm.includes('bedrock') ||
    norm.includes('comprehend') ||
    norm.includes('rekognition') ||
    norm.includes('polly') ||
    norm.includes('machinelearning')
  ) {
    return AWS_CATEGORY_COLORS.ml;
  }

  // 9. Developer Tools (AWS Developer Blue #0073BB)
  if (
    norm.includes('codebuild') ||
    norm.includes('codepipeline') ||
    norm.includes('codecommit') ||
    norm.includes('codedeploy') ||
    norm.includes('xray')
  ) {
    return AWS_CATEGORY_COLORS.developer;
  }

  // 10. Compute & Containers (AWS Compute Orange #FF9900)
  if (
    norm.includes('ec2') ||
    norm.includes('elasticcompute') ||
    norm.includes('lambda') ||
    norm.includes('ecs') ||
    norm.includes('eks') ||
    norm.includes('fargate') ||
    norm.includes('batch') ||
    norm.includes('apprunner') ||
    norm.includes('compute')
  ) {
    return AWS_CATEGORY_COLORS.compute;
  }

  // Default Fallback
  return AWS_CATEGORY_COLORS.compute;
}

/**
 * Returns complete style attributes (hex color, transparent pill background, border)
 * for rendered badges, chips, or cards.
 */
export function getAwsServiceColorStyles(serviceName = '') {
  const hex = getAwsServiceColor(serviceName);
  return {
    color: hex,
    backgroundColor: `${hex}1A`, // 10% opacity
    borderColor: `${hex}4D`,     // 30% opacity
  };
}
