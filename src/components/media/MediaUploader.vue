<template>
  <div
    class="upload-zone"
    :class="{
      'upload-zone--active': isDragging,
      'upload-zone--disabled': disabled
    }"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="onDrop"
    @click="openFilePicker"
  >
    <input
      ref="fileInput"
      type="file"
      :accept="accept"
      multiple
      hidden
      @change="onFileSelect"
    />
    <div class="upload-content">
      <IconUpload class="upload-icon" />
      <span class="upload-text">
        Drop files here or <span class="upload-link">browse</span>
      </span>
    </div>
    <div class="upload-hints">
      <span class="upload-hint"><IconPhoto class="upload-hint-icon" />Images</span>
      <span class="upload-hint"><IconVideo class="upload-hint-icon" />Video</span>
      <span class="upload-hint"><IconMusic class="upload-hint-icon" />Audio</span>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { IconUpload, IconPhoto, IconVideo, IconMusic } from '@iconify-prerendered/vue-tabler'

defineProps({
  disabled: { type: Boolean, default: false },
  accept: { type: String, default: 'image/*,video/*,audio/*' }
})

const emit = defineEmits(['upload'])
const fileInput = ref(null)
const isDragging = ref(false)

function onDragOver() {
  isDragging.value = true
}

function onDrop(e) {
  isDragging.value = false
  if (e.dataTransfer?.files?.length) {
    emit('upload', e.dataTransfer.files)
  }
}

function openFilePicker() {
  fileInput.value?.click()
}

function onFileSelect(e) {
  if (e.target.files?.length) {
    emit('upload', e.target.files)
    e.target.value = ''
  }
}
</script>

<style scoped>
.upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  border: 1.5px dashed rgba(0, 0, 0, 0.12);
  border-radius: 0.5rem;
  padding: 0.75rem 1.25rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #fafafa;
}

.upload-zone:hover {
  border-color: #f97316;
  background: #fff7ed;
}

.upload-zone:hover .upload-icon {
  color: #f97316;
  transform: translateY(-1px);
}

.upload-zone--active {
  border-color: #f97316;
  background: #fff7ed;
  border-style: solid;
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
}

.upload-zone--active .upload-icon {
  color: #f97316;
  transform: translateY(-1px);
}

.upload-zone--disabled {
  opacity: 0.5;
  pointer-events: none;
}

.upload-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.upload-icon {
  color: #9ca3af;
  flex-shrink: 0;
  width: 1.125rem;
  height: 1.125rem;
  transition: all 0.15s ease;
}

.upload-text {
  color: #6b7280;
  font-size: 0.8125rem;
  white-space: nowrap;
}

.upload-link {
  color: #f97316;
  font-weight: 500;
  text-decoration: none;
}

.upload-link:hover {
  text-decoration: underline;
}

.upload-hints {
  display: flex;
  gap: 0.625rem;
}

.upload-hint {
  display: flex;
  align-items: center;
  gap: 0.1875rem;
  font-size: 0.6875rem;
  color: #b0b0b0;
}

.upload-hint-icon {
  width: 0.6875rem;
  height: 0.6875rem;
  opacity: 0.5;
}

@media (max-width: 768px) {
  .upload-zone {
    padding: 0.75rem;
  }
}
</style>
