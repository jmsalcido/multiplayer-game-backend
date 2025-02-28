# Dynamo DB

- We need to create the table before using this server.js

``` bash
aws dynamodb create-table \
    --table-name PlayerSessions \
    --attribute-definitions AttributeName=sessionId,AttributeType=S \
    --key-schema AttributeName=sessionId,KeyType=HASH \
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --region us-east-1
```