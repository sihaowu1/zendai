import { CodeEditor } from './CodeEditor';

export type EditorTab = 'scene' | 'blender';

interface Props {
  tab: EditorTab;
  onTabChange: (tab: EditorTab) => void;
  sceneCode: string;
  blenderCode: string;
  onSceneChange: (code: string) => void;
  onBlenderChange: (code: string) => void;
}

/** Two editable documents: the Three.js scene module and the Blender script. */
export function EditorTabs({
  tab,
  onTabChange,
  sceneCode,
  blenderCode,
  onSceneChange,
  onBlenderChange,
}: Props) {
  const tabClass = (active: boolean) =>
    `rounded-none border-none bg-transparent px-3.5 py-2 font-mono text-xs font-medium text-text-dim ${
      active ? 'text-text shadow-[inset_0_-2px_0_var(--color-accent)]' : ''
    }`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex border-b border-border bg-bg-panel">
        <button type="button" className={tabClass(tab === 'scene')} onClick={() => onTabChange('scene')}>
          scene.module.js
        </button>
        <button
          type="button"
          className={tabClass(tab === 'blender')}
          onClick={() => onTabChange('blender')}
        >
          scene.blender.py
        </button>
      </div>
      {tab === 'scene' ? (
        <CodeEditor value={sceneCode} language="javascript" onChange={onSceneChange} />
      ) : (
        <CodeEditor value={blenderCode} language="python" onChange={onBlenderChange} />
      )}
    </div>
  );
}
