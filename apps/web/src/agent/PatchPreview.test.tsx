// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PatchPreview from './PatchPreview'

describe('PatchPreview', () => {
  it('identifies the background and character that an Agent scene will use before approval', () => {
    render(<PatchPreview
      onSelectNode={vi.fn()}
      patch={{
        id: 'patch', status: 'proposed', baseVersion: 1, appliedVersion: null,
        validation: { valid: true },
        diff: { addedNodeIds: ['background', 'character'], updatedNodeIds: [], removedNodeIds: [], addedEdgeIds: [], removedEdgeIds: [] },
        payload: { operations: [
          { kind: 'addNode', tempId: 'background', node: { type: 'background', data: { backgroundId: '/uploads/harbor.png' } } },
          { kind: 'addNode', tempId: 'character', node: { type: 'character', data: { characterId: 'snow', sceneGroupId: 'agent-draft' } } },
        ] },
      }}
    />)

    expect(screen.getByText('已分配素材')).toBeInTheDocument()
    expect(screen.getByText('背景：/uploads/harbor.png')).toBeInTheDocument()
    expect(screen.getByText('角色：snow')).toBeInTheDocument()
    expect(screen.getByText(/应用后会出现在左侧场景树/)).toBeInTheDocument()
  })
})
