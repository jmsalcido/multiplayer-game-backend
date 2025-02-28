variable "application_name" {
  description = "Name of the Elastic Beanstalk application"
  type        = string
}

variable "application_description" {
  description = "Description of the Elastic Beanstalk application"
  type        = string
  default     = "Elastic Beanstalk Application for Multiplayer Game Backend"
}

variable "environment_name" {
  description = "Name of the Elastic Beanstalk environment"
  type        = string
}

variable "solution_stack_name" {
  description = "The solution stack for the Elastic Beanstalk environment"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type for EBS"
  type        = string
  default     = "t3.micro"
}

variable "environment_type" {
  description = "Environment type: LoadBalanced or SingleInstance"
  type        = string
  default     = "LoadBalanced"
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}