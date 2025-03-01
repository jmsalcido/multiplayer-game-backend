resource "aws_s3_bucket" "client_site" {
  bucket        = var.bucket_name
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "client_site_public_access" {
  bucket                  = aws_s3_bucket.client_site.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_website_configuration" "client_site_config" {
  bucket = aws_s3_bucket.client_site.id

  index_document {
    suffix = var.index_document
  }

  error_document {
    key = var.error_document
  }
}

resource "aws_s3_bucket_policy" "client_site_policy" {
  bucket = aws_s3_bucket.client_site.id

  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Sid       = "PublicReadGetObject",
        Effect    = "Allow",
        Principal = "*",
        Action    = "s3:GetObject",
        Resource  = "${aws_s3_bucket.client_site.arn}/*"
      }
    ]
  })
}

resource "aws_s3_object" "client_html" {
  bucket       = aws_s3_bucket.client_site.bucket
  key          = var.object_key
  source       = var.object_source
  content_type = "text/html"
  # Removed the acl attribute because the bucket does not allow ACLs.
}