variable "table_name" {
  description = "Name of the DynamoDB table"
  type        = string
}

variable "read_capacity" {
  description = "Provisioned read capacity units"
  type        = number
  default     = 5
}

variable "write_capacity" {
  description = "Provisioned write capacity units"
  type        = number
  default     = 5
}

variable "tags" {
  description = "Tags to apply to the table"
  type        = map(string)
  default     = {}
}