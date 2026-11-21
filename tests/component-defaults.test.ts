import { componentSource } from "./helpers/component-source";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { parse as parseSfc } from "vue/compiler-sfc";
import { appShellComponentRegistry as catalog } from "../packages/app-shell/src/registry";

const root = path.resolve(import.meta.dirname, "..");

/** 读取直接字面量或显式导入的参数合同；不执行工厂或求值表达式。 */
export function literalDefaults(
  source: string,
  filename?: string,
): Record<string, string> {
  const { descriptor } = parseSfc(source, { filename: filename || "x.vue" });
  const body =
    descriptor.scriptSetup?.content ?? descriptor.script?.content ?? "";
  const tree = ts.createSourceFile(
    filename || "x.ts",
    body,
    ts.ScriptTarget.Latest,
    true,
  );
  let value: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(tree) === "withDefaults"
    )
      value = node.arguments[1];
    ts.forEachChild(node, visit);
  }
  visit(tree);
  if (value && ts.isIdentifier(value) && filename) {
    const binding = value.text;
    for (const statement of tree.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      )
        continue;
      const members = statement.importClause?.namedBindings;
      const imported =
        members && ts.isNamedImports(members)
          ? members.elements.find((member) => member.name.text === binding)
          : undefined;
      if (!imported || !statement.moduleSpecifier.text.startsWith("."))
        continue;
      const module = path.resolve(
        path.dirname(filename),
        statement.moduleSpecifier.text + ".ts",
      );
      if (!fs.existsSync(module)) continue;
      const contract = ts.createSourceFile(
        module,
        fs.readFileSync(module, "utf8"),
        ts.ScriptTarget.Latest,
        true,
      );
      const exported = imported.propertyName?.text ?? imported.name.text;
      value = contract.statements
        .filter(ts.isVariableStatement)
        .flatMap((node) => [...node.declarationList.declarations])
        .find(
          (node) => ts.isIdentifier(node.name) && node.name.text === exported,
        )?.initializer;
      break;
    }
  }
  while (
    value &&
    (ts.isAsExpression(value) ||
      ts.isSatisfiesExpression(value) ||
      ts.isParenthesizedExpression(value))
  )
    value = value.expression;
  if (!value || !ts.isObjectLiteralExpression(value)) return {};
  const result: Record<string, string> = {};
  for (const property of value.properties) {
    if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name))
      continue;
    const literal = property.initializer;
    if (ts.isStringLiteral(literal) || ts.isNumericLiteral(literal))
      result[property.name.text] = literal.text;
    else if (literal.kind === ts.SyntaxKind.TrueKeyword)
      result[property.name.text] = "true";
    else if (literal.kind === ts.SyntaxKind.FalseKeyword)
      result[property.name.text] = "false";
  }
  return result;
}

/** 文档里那格：「必填 / —」表示没有默认值，其余按字面比对。 */
function documentedDefault(raw: string): string | undefined {
  const text = raw.trim();
  if (text === "必填" || text === "—" || text === "") return undefined;
  return text.replace(/^['"]|['"]$/g, "");
}

/**
 * 空串在源码里常是「哨兵」：置空后组件会回落到一个派生值
 * （如 `ariaLabel: ''` 时回落到 `statusBadgeTitle(items)`）。
 * 这时文档描述回落行为比抄一个 `''` 更准确，不算失真。
 */
function isSentinelEmpty(codeDefault: string, docDefault: string | undefined) {
  return codeDefault === "" && docDefault !== undefined && docDefault !== "";
}

test("catalog 里手写的默认值与源码 withDefaults 的字面默认值一致", () => {
  const mismatches: string[] = [];
  for (const item of catalog) {
    if (item.type !== "vue") continue;
    const file = componentSource(item);
    const defaults = literalDefaults(fs.readFileSync(file, "utf8"), file);
    for (const prop of item.props) {
      // 并格（`width / height`、`completed / total`）一格讲多个属性，值也是合并写的，
      // 无法一对一比对；只校验一格只讲一个属性的行。
      if (prop.name.includes("/")) continue;
      const name = prop.name.trim();
      if (!(name in defaults)) continue;
      const doc = documentedDefault(prop.default);
      if (isSentinelEmpty(defaults[name], doc)) continue;
      if (doc === undefined) {
        mismatches.push(
          `${item.id}.${name}：文档写「${prop.default}」，源码默认 ${defaults[name]}`,
        );
      } else if (doc !== defaults[name]) {
        mismatches.push(
          `${item.id}.${name}：文档「${doc}」≠ 源码「${defaults[name]}」`,
        );
      }
    }
  }
  assert.deepEqual(mismatches, []);
});

test("literalDefaults 识别字面值，忽略数组工厂", () => {
  const defaults = literalDefaults(
    '<script setup lang="ts">withDefaults(defineProps<{mode?:string;items?:string[]}>(), {mode:"dark",items:()=>[]});</script>',
  );
  assert.equal(defaults.mode, "dark");
  assert.ok(!("items" in defaults));
});
