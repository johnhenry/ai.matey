#!/bin/bash
# JSDoc Audit Script
# Finds all exported items that may need documentation

echo "=== JSDoc Documentation Audit ==="
echo ""

PACKAGES=(
  "ai.matey"
  "ai.matey.core"
  "ai.matey.types"
  "ai.matey.errors"
  "ai.matey.utils"
  "ai.matey.testing"
  "backend"
  "backend-browser"
  "frontend"
  "middleware"
  "http"
  "http.core"
  "react-core"
  "react-hooks"
  "react-stream"
  "react-nextjs"
)

for pkg in "${PACKAGES[@]}"; do
  echo "📦 Package: $pkg"
  echo "----------------------------------------"

  # Find all exports
  find "../$pkg/src" -name "*.ts" -type f ! -name "*.test.ts" ! -name "*.spec.ts" | while read file; do
    # Count exports
    exports=$(grep -E "^export (class|interface|type|const|enum|function|async function)" "$file" | wc -l)

    if [ $exports -gt 0 ]; then
      # Count JSDoc comments (/** ... */)
      jsdocs=$(grep -B1 -E "^export (class|interface|type|const|enum|function|async function)" "$file" | grep -c "/\*\*")

      ratio=$(echo "scale=1; $jsdocs / $exports" | bc)

      if (( $(echo "$ratio < 1.0" | bc -l) )); then
        echo "  ⚠️  $file"
        echo "      Exports: $exports | JSDoc: $jsdocs | Ratio: $ratio"
      fi
    fi
  done

  echo ""
done

echo "=== Audit Complete ==="
echo ""
echo "Next Steps:"
echo "1. Review files with ratio < 1.0"
echo "2. Add JSDoc to ALL exports (classes, interfaces, types, functions, constants)"
echo "3. Re-run: npm run api:generate"
echo "4. Check TypeDoc warnings for 'notDocumented' items"
