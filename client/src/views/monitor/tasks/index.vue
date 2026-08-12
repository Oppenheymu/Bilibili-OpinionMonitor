<template>
  <div class="card table-box">
    <div class="table-header">
      <el-button type="primary" :icon="CirclePlus" @click="openDialog()">新建任务</el-button>
      <el-button :icon="Refresh" @click="loadData">刷新</el-button>
    </div>

    <el-table :data="tableData" v-loading="loading" border stripe style="width: 100%">
      <el-table-column prop="id" label="ID" width="70" align="center" />
      <el-table-column prop="type" label="类型" width="100">
        <template #default="{ row }">
          <el-tag :type="row.type === 'up主' ? 'primary' : 'success'" effect="plain">{{ row.type }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="target" label="目标" show-overflow-tooltip />
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'" effect="dark">{{ row.enabled ? "启用" : "禁用" }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="最后采集" width="170">
        <template #default="{ row }">{{ formatTime(row.lastCollectedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" :icon="row.enabled ? TurnOff : Open" @click="toggleStatus(row)">
            {{ row.enabled ? "禁用" : "启用" }}
          </el-button>
          <el-button link type="danger" :icon="Delete" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新建任务弹窗 -->
    <el-dialog v-model="dialogVisible" title="新建监控任务" width="460px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="70px">
        <el-form-item label="类型" prop="type">
          <el-select v-model="form.type" placeholder="选择任务类型" style="width: 100%">
            <el-option label="UP主" value="up主" />
            <el-option label="关键词" value="关键词" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标" prop="target">
          <el-input v-model="form.target" :placeholder="form.type === 'up主' ? '请输入 UP主 UID' : '请输入关键词'" clearable />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="monitorTasks">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormInstance } from "element-plus";
import { CirclePlus, Delete, Open, Refresh, TurnOff } from "@element-plus/icons-vue";
import { createTaskApi, deleteTaskApi, getTaskListApi, updateTaskApi } from "@/api/modules/monitor";
import type { Monitor } from "@/api/interface/monitor";
import { formatTime } from "@/utils/time";

const tableData = ref<Monitor.Task[]>([]);
const loading = ref(false);

const loadData = async () => {
  loading.value = true;
  try {
    tableData.value = await getTaskListApi();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载任务列表失败");
  } finally {
    loading.value = false;
  }
};

const toggleStatus = async (row: any) => {
    try {
        await updateTaskApi(row.id, !row.enabled);
        ElMessage.success(`已${row.enabled ? "禁用" : "启用"}任务`);
        await loadData();
    } catch (e) {
        ElMessage.error(e instanceof Error ? e.message : "操作失败");
    }
};

const handleDelete = (row: any) => {
    ElMessageBox.confirm(`确认删除任务「${row.target}」吗？删除后不可恢复。`, "删除确认", {
        type: "warning",
        confirmButtonText: "确定删除",
        cancelButtonText: "取消",
    })
        .then(async () => {
            try {
                await deleteTaskApi(row.id);
                ElMessage.success("已删除");
                await loadData();
            } catch (e) {
                ElMessage.error(e instanceof Error ? e.message : "删除失败");
            }
        })
        .catch(() => {});
};

const dialogVisible = ref(false);
const submitting = ref(false);
const formRef = ref<FormInstance>();
const form = reactive({ type: "up主", target: "" });
const rules = {
    type: [{ required: true, message: "请选择类型", trigger: "change" }],
    target: [{ required: true, message: "请输入目标", trigger: "blur" }],
};

const openDialog = () => {
    form.type = "up主";
    form.target = "";
    dialogVisible.value = true;
};

const handleSubmit = async () => {
    if (!formRef.value) return;
    await formRef.value.validate(async (valid) => {
        if (!valid) return;
        submitting.value = true;
        try {
            await createTaskApi(form.type, form.target);
            ElMessage.success("任务创建成功");
      dialogVisible.value = false;
      await loadData();
    } catch (e) {
      ElMessage.error(e instanceof Error ? e.message : "创建失败");
    } finally {
      submitting.value = false;
    }
  });
};

onMounted(loadData);
</script>

<style scoped lang="scss">
@import "./index.scss";
</style>
