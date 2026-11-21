<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { CxxButton, CxxInput, CxxPanelForm, CxxSelect } from '@cxx/ui';
import newItemIcon from '@cxx/icons/assets/03-new-project.svg';
import { normalizeFileManagementSettings, openerKind } from '../../../../../file-management/model';
import type { FileManageClient, OpeningSettings, SuffixRule, ToolSettings } from '../../../../../file-management/types';

/**
 * 「文件夹与打开方式」：配置工具与打开规则。
 *
 * 本组件有两处宿主 —— 设置页的一整页，以及缺配置时弹出的引导框（保存成功后接着完成那次打开）。
 * 两处的字段与校验必须一致，所以只有这一份实现。
 */
const props = withDefaults(
  defineProps<{ client: FileManageClient; submitLabel?: string; showSubmit?: boolean }>(),
  { submitLabel: '保存文件夹与打开方式', showSubmit: true },
);
const emit = defineEmits<{ error: [error: unknown]; ready: [] }>();

interface RuleDraft {
  suffix: string;
  kind: 'tool' | 'system' | 'custom';
  command: string;
}

const tool = reactive<ToolSettings>({ command: '', name: '' });
const folderTarget = ref<OpeningSettings['folderTarget']>('tool');
const fileTarget = ref<OpeningSettings['fileTarget']>('system');
const rules = ref<RuleDraft[]>([]);
const loaded = ref(false);
const busy = ref(false);
const saved = ref(false);
const error = ref('');
const highlight = ref('');
const editorGroup = ref<HTMLElement>();
const openingGroup = ref<HTMLElement>();
let alive = true;

const FOLDER_OPTIONS = [
  { value: 'tool', label: '配置工具' },
  { value: 'system', label: '系统文件管理器' },
];
const FILE_OPTIONS = [
  { value: 'system', label: '系统默认程序' },
  { value: 'tool', label: '配置工具' },
];
const OPENER_OPTIONS = [
  { value: 'system', label: '系统默认程序' },
  { value: 'tool', label: '配置工具' },
  { value: 'custom', label: '指定应用' },
];

function apply(settings: ReturnType<typeof normalizeFileManagementSettings>) {
  tool.command = settings.editor.command;
  tool.name = settings.editor.name;
  folderTarget.value = settings.opening.folderTarget;
  fileTarget.value = settings.opening.fileTarget;
  rules.value = settings.opening.suffixRules.map((rule: SuffixRule) => {
    const kind = openerKind(rule.opener);
    return { suffix: rule.suffix, kind, command: kind === 'custom' ? rule.opener : '' };
  });
}

async function load() {
  busy.value = true;
  error.value = '';
  try {
    const settings = normalizeFileManagementSettings(await props.client.getSettings());
    if (!alive) return;
    apply(settings);
    loaded.value = true;
    emit('ready');
  } catch (reason) {
    if (alive) error.value = '加载设置失败：' + (reason instanceof Error ? reason.message : reason);
  } finally {
    if (alive) busy.value = false;
  }
}

/** 选中的可执行文件先只改草稿；按保存才落盘。 */
async function pickTool(into?: RuleDraft) {
  if (busy.value) return;
  busy.value = true;
  try {
    const result = await props.client.pickTool();
    if (result?.canceled) return;
    if (!result?.success || !result.path) throw new Error(result?.error || '选择应用失败');
    if (into) into.command = result.path;
    else {
      tool.command = result.path;
      tool.name = result.name || '';
    }
    saved.value = false;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    busy.value = false;
  }
}

function addRule() {
  rules.value.push({ suffix: '', kind: 'system', command: '' });
  saved.value = false;
}

function removeRule(index: number) {
  rules.value.splice(index, 1);
  saved.value = false;
}

/** 切换打开方式时清掉另一种取值，避免"选了系统程序却还留着上个应用的路径"。 */
function changeRuleKind(rule: RuleDraft, kind: string) {
  rule.kind = (kind === 'custom' || kind === 'tool' ? kind : 'system') as RuleDraft['kind'];
  if (rule.kind !== 'custom') rule.command = '';
  saved.value = false;
}

/** 落盘；返回是否成功，引导框据此决定要不要继续原来的打开动作。 */
async function save(): Promise<boolean> {
  if (busy.value) return false;
  busy.value = true;
  saved.value = false;
  error.value = '';
  try {
    const value = await props.client.saveSettings({
      editor: { command: tool.command, name: tool.name },
      opening: {
        folderTarget: folderTarget.value,
        fileTarget: fileTarget.value,
        suffixRules: rules.value
          .map((rule) => ({
            suffix: rule.suffix.trim().toLowerCase(),
            opener: rule.kind === 'custom' ? rule.command : rule.kind,
          }))
          .filter((rule) => rule.suffix),
      },
    });
    if (alive) {
      apply(normalizeFileManagementSettings(value));
      saved.value = true;
    }
    return true;
  } catch (reason) {
    if (alive) {
      error.value = reason instanceof Error ? reason.message : String(reason);
      emit('error', reason);
    }
    return false;
  } finally {
    if (alive) busy.value = false;
  }
}

/** 把焦点移到缺配置的那一组，保留高亮直到保存或关闭。 */
function focus(group: 'editor' | 'opening') {
  highlight.value = group;
  const element = group === 'editor' ? editorGroup.value : openingGroup.value;
  element?.querySelector<HTMLElement>('button, input')?.focus();
}

/** 引导框用的校验：该组还缺必需项时返回提示文案，空串表示可以保存。 */
function validate(group: 'editor' | 'opening'): string {
  if (group === 'editor' && !tool.command) return '请先选择打开工具';
  return '';
}

onMounted(load);
defineExpose({ save, focus, validate });
</script>
<template>
  <form class="cxx-file-manage" :aria-busy="busy" @submit.prevent="save">
    <CxxPanelForm class="cxx-file-manage-panel">
    <div class="cxx-file-manage-fields">
    <h3 class="cxx-file-manage-title">默认设置</h3>
    <p class="cxx-file-manage-hint">打开规则用于项目、文件夹和工作台文件。</p>

    <section
      ref="editorGroup"
      class="cxx-file-manage-group"
      :class="{ 'is-highlight': highlight === 'editor' }"
      data-group="editor"
      tabindex="-1"
    >
      <div class="cxx-file-manage-group-title">配置工具</div>
      <p class="cxx-file-manage-hint">打开规则选择「配置工具」时使用的 IDE 或编辑器</p>
      <div class="cxx-file-manage-tool">
        <span class="cxx-file-manage-tool-value">
          <strong>{{ tool.name || (tool.command ? '已选择应用' : '未选择应用') }}</strong>
          <code :title="tool.command">{{ tool.command }}</code>
        </span>
        <CxxButton :disabled="busy" @click="pickTool()">{{ busy ? '选择中…' : '选择应用' }}</CxxButton>
      </div>
    </section>

    <section
      ref="openingGroup"
      class="cxx-file-manage-group"
      :class="{ 'is-highlight': highlight === 'opening' }"
      data-group="opening"
      tabindex="-1"
    >
      <div class="cxx-file-manage-group-title">默认打开方式</div>
      <p class="cxx-file-manage-hint">
        主打开按钮使用这里的规则；显式「文件管理器/系统程序」动作不受影响
      </p>
      <div class="cxx-file-manage-row">
        <span class="cxx-file-manage-label">文件夹</span>
        <CxxSelect v-model="folderTarget" label="文件夹" :options="FOLDER_OPTIONS" :disabled="busy" />
      </div>
      <div class="cxx-file-manage-row">
        <span class="cxx-file-manage-label">普通文件</span>
        <CxxSelect v-model="fileTarget" label="普通文件" :options="FILE_OPTIONS" :disabled="busy" />
      </div>
      <div class="cxx-file-manage-row cxx-file-manage-row-block">
        <span class="cxx-file-manage-label">后缀覆盖</span>
        <div class="cxx-file-manage-rules">
          <div v-for="(rule, index) in rules" :key="index" class="cxx-file-manage-rule">
            <CxxInput v-model="rule.suffix" label="文件后缀" placeholder=".java" :disabled="busy" />
            <CxxSelect
              v-model="rule.kind"
              label="打开方式"
              :options="OPENER_OPTIONS"
              :disabled="busy"
              @update:model-value="changeRuleKind(rule, $event)"
            />
            <template v-if="rule.kind === 'custom'">
              <span class="cxx-file-manage-rule-app">
                <span class="cxx-file-manage-rule-path" :title="rule.command">
                  {{ rule.command || '未选择应用' }}
                </span>
                <CxxButton :disabled="busy" @click="pickTool(rule)">选择应用</CxxButton>
              </span>
            </template>
            <CxxButton :disabled="busy" @click="removeRule(index)">移除</CxxButton>
          </div>
          <CxxButton :icon="newItemIcon" :disabled="busy" @click="addRule">添加后缀规则</CxxButton>
        </div>
      </div>
    </section>

    <CxxButton v-if="!loaded" :disabled="busy" @click="load">
      {{ busy ? '加载中…' : '重试加载' }}
    </CxxButton>
    </div>
    <template v-if="showSubmit || error || saved" #footer>
      <div v-if="error || saved" class="cxx-panel-form-feedback">
        <p v-if="error" role="alert">{{ error }}</p>
        <p v-if="saved" role="status">文件夹与打开方式已保存</p>
      </div>
      <CxxButton v-if="showSubmit" preset="confirm" type="submit" :label="submitLabel" :disabled="busy || !loaded" :busy="busy" />
    </template>
    </CxxPanelForm>
  </form>
</template>
