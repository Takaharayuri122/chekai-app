import { useRef } from 'react';
import { View, Text } from 'react-native';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';

interface RichTextEditorProps {
  label: string;
  initialValue: string;
  onChange: (html: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

const TOOLBAR_ACTIONS = [
  actions.setBold,
  actions.setItalic,
  actions.setUnderline,
  actions.insertBulletsList,
  actions.insertOrderedList,
  actions.heading2,
  actions.undo,
  actions.redo,
];

/**
 * Editor de texto rico (HTML) para os campos do relatório técnico. Mantém o valor
 * inicial e propaga o HTML editado via `onChange`. Funciona offline.
 */
export function RichTextEditor({
  label,
  initialValue,
  onChange,
  placeholder = 'Escreva aqui...',
  required = false,
  disabled = false,
}: RichTextEditorProps) {
  const editorRef = useRef<RichEditor>(null);
  return (
    <View>
      <Text className="text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required ? <Text className="text-red-500"> *</Text> : null}
      </Text>
      <View className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        {!disabled ? (
          <RichToolbar
            editor={editorRef}
            actions={TOOLBAR_ACTIONS}
            selectedIconTint="#00B8A9"
            iconTint="#6B7280"
            style={{ backgroundColor: '#F9FAFB', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}
          />
        ) : null}
        <RichEditor
          ref={editorRef}
          initialContentHTML={initialValue}
          placeholder={placeholder}
          disabled={disabled}
          onChange={onChange}
          useContainer
          initialHeight={140}
          editorStyle={{
            contentCSSText: 'font-size: 15px; color: #1F2937; padding: 4px;',
            placeholderColor: '#9CA3AF',
          }}
          style={{ minHeight: 140 }}
        />
      </View>
    </View>
  );
}
