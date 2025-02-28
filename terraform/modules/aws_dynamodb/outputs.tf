output "table_name" {
  value = aws_dynamodb_table.player_sessions.name
}

output "table_arn" {
  value = aws_dynamodb_table.player_sessions.arn
}