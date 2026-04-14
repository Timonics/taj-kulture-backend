#!/bin/bash

echo "🚀 TAJ KULTURE API TEST SUITE"
echo "=============================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Base URL
BASE_URL="http://localhost:3000"

echo -e "\n${GREEN}1. Registering user...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User"
  }')
echo $REGISTER_RESPONSE | jq .

echo -e "\n${GREEN}2. Logging in...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }')
echo $LOGIN_RESPONSE | jq .

# Extract token (requires jq)
TOKEN=$(echo $LOGIN_RESPONSE | jq -r .accessToken)

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
  echo -e "\n${GREEN}3. Getting profile...${NC}"
  curl -s -X GET $BASE_URL/auth/profile \
    -H "Authorization: Bearer $TOKEN" | jq .
else
  echo -e "\n${RED}Failed to get token${NC}"
fi
