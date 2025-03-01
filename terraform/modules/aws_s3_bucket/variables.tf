variable "bucket_name" {
  description = "The name of the S3 bucket to host the client"
  type        = string
}

variable "index_document" {
  description = "The index document for the static website"
  type        = string
  default     = "client.html"
}

variable "error_document" {
  description = "The error document for the static website"
  type        = string
  default     = "error.html"
}

variable "object_key" {
  description = "The key under which the client file will be stored"
  type        = string
  default     = "client.html"
}

variable "object_source" {
  description = "The local path to the client file"
  type        = string
}

variable "region" {
  description = "AWS region used for constructing the website endpoint"
  type        = string
}