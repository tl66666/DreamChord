export function editorPaneClasses(sidePanelOpen: boolean) {
  return {
    tree: 'hidden shrink-0 border-r border-dream-100 lg:block lg:w-64',
    center: `${sidePanelOpen ? 'hidden lg:block' : 'block'} min-w-0 flex-1 overflow-hidden`,
    side: `${sidePanelOpen ? 'block w-full' : 'hidden'} shrink-0 border-l border-dream-100 lg:block lg:w-80`,
  }
}
