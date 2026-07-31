<template>
  <div class="card table-box">
    <div class="table-header">
      <el-button type="primary" :icon="CirclePlus" @click="openDialog()">新建任务</el-button>
      <el-button :icon="Refresh" @click="loadData">刷新</el-button>
    </div>

    <el-table :data="tableData" v-loading="loading" border stripe style="width: 100%">
      <el-table-column prop="任务ID" label="ID" width="70" align="center" />
      <el-table-column prop="类型" label="类型" width="100">
        <template #default="{ row }">
          <el-tag :type="row.类型 === 'up主' ? 'primary' : 'success'" effect="plain">{{ row.类型 }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="目标" label="目标" show-overflow-tooltip />
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.启用 ? 'success' : 'info'" effect="dark">{{ row.启用 ? "启用" : "禁用" }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">{{ formatTime(row.创建时间) }}</template>
      </el-table-column>
      <el-table-column label="最后采集" width="170">
        <template #default="{ row }">{{ formatTime(row.最后采集时间) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" :icon="row.启用 ? TurnOff : Open" @click="toggleStatus(row)">
            {{ row.启用 ? "禁用" : "启用" }}
          </el-button>
          <el-button link type="danger" :icon="Delete" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新建任务弹窗 -->
    <el-dialog v-model="dialogVisible" title="新建监控任务" width="460px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="70px">
        <el-form-item label="类型" prop="类型">
          <el-select v-model="form.类型" placeholder="选择任务类型" style="width: 100%">
            <el-option label="UP主" value="up主" />
            <el-option label="关键词" value="关键词" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标" prop="目标">
          <el-input v-model="form.目标" :placeholder="form.类型 === 'up主' ? '请输入 UP主 UID' : '请输入关键词'" clearable />
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
import { Monitor } from "@/api/interface/monitor";
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
    await updateTaskApi(row.任务ID, !row.启用);
    ElMessage.success(`已${row.启用 ? "禁用" : "启用"}任务`);
    await loadData();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "操作失败");
  }
};

const handleDelete = (row: any) => {
  ElMessageBox.confirm(`确认删除任务「${row.目标}」吗？删除后不可恢复。`, "删除确认", {
    type: "warning",
    confirmButtonText: "确定删除",
    cancelButtonText: "取消"
  })
    .then(async () => {
      try {
        await deleteTaskApi(row.任务ID);
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
const form = reactive({ 类型: "up主", 目标: "" });
const rules = {
  类型: [{ required: true, message: "请选择类型", trigger: "change" }],
  目标: [{ required: true, message: "请输入目标", trigger: "blur" }]
};

const openDialog = () => {
  form.类型 = "up主";
  form.目标 = "";
  dialogVisible.value = true;
};

const handleSubmit = async () => {
  if (!formRef.value) return;
  await formRef.value.validate(async valid => {
    if (!valid) return;
    submitting.value = true;
    try {
      await createTaskApi(form.类型, form.目标);
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
