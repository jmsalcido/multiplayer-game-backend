output "website_endpoint" {
  description = "The S3 static website endpoint"
  value       = format("http://%s.s3-website.%s.amazonaws.com", aws_s3_bucket.client_site.bucket, var.region)
}

output "bucket_name" {
  description = "The name of the S3 bucket"
  value       = aws_s3_bucket.client_site.bucket
}