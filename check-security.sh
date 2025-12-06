#!/bin/bash
echo "🔒 Lovculator Security Audit"
echo "============================"

# Check .gitignore
echo -e "\n1. Checking .gitignore..."
if grep -q "\.env" .gitignore; then
    echo "✅ .env in .gitignore"
else
    echo "❌ .env NOT in .gitignore"
fi

# Check tracked files
echo -e "\n2. Checking tracked files..."
TRACKED_ENV=$(git ls-files | grep -i "\.env")
if [ -z "$TRACKED_ENV" ]; then
    echo "✅ No .env files tracked"
else
    echo "❌ .env files tracked:"
    echo "$TRACKED_ENV"
fi

# Check for hardcoded secrets
echo -e "\n3. Scanning for hardcoded secrets..."
SECRET_FOUND=false
find . -type f \( -name "*.js" -o -name "*.ts" -o -name "*.json" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/.env*" \
  -exec grep -l -E "DATABASE_URL.*@|SESSION_SECRET=|EMAIL_PASS=|password.*['\"]" {} \; | while read file; do
    echo "⚠️  Potential secret in: $file"
    SECRET_FOUND=true
done

if [ "$SECRET_FOUND" = false ]; then
    echo "✅ No hardcoded secrets found"
fi

# Check commit history
echo -e "\n4. Checking commit history..."
if git log --all --oneline | grep -i "secret\|password\|env" | head -5; then
    echo "⚠️  Suspicious commit messages found"
else
    echo "✅ No suspicious commit messages"
fi

echo -e "\n📋 Audit complete"
