/** `notes` namespace dictionaries. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'trigger.aria': '便签',
  'panel.title': '便签',
  'panel.execute': '执行便签任务',
  'panel.import': '导入对话',
  'panel.close': '关闭',
  'panel.empty': '暂无便签',
  'panel.add': '添加便签',
  'editor.aria': '便签内容',
  'editor.placeholder': '记一条便签…',
  'editor.save': '保存',
  'editor.cancel': '取消',
  'card.pin': '置顶',
  'card.unpin': '取消置顶',
  'card.edit': '编辑',
  'card.delete': '删除',
  'color.yellow': '黄色',
  'color.green': '绿色',
  'color.blue': '蓝色',
  'color.pink': '粉色',
  'color.purple': '紫色',
  'color.gray': '灰色',
} satisfies Record<string, string>

/** The notes namespace key union. */
export type NotesKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'trigger.aria': 'Sticky notes',
  'panel.title': 'Sticky notes',
  'panel.execute': 'Run note tasks',
  'panel.import': 'Send to chat',
  'panel.close': 'Close',
  'panel.empty': 'No notes yet',
  'panel.add': 'Add note',
  'editor.aria': 'Note text',
  'editor.placeholder': 'Jot a note…',
  'editor.save': 'Save',
  'editor.cancel': 'Cancel',
  'card.pin': 'Pin',
  'card.unpin': 'Unpin',
  'card.edit': 'Edit',
  'card.delete': 'Delete',
  'color.yellow': 'Yellow',
  'color.green': 'Green',
  'color.blue': 'Blue',
  'color.pink': 'Pink',
  'color.purple': 'Purple',
  'color.gray': 'Gray',
} satisfies Record<NotesKey, string>
