// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import StageCharacters from './StageCharacters'

describe('StageCharacters', () => {
  afterEach(cleanup)

  it('renders human characters as focused busts and keeps the ghost whole', () => {
    render(
      <StageCharacters
        characters={[
          { id: 'yuki', state: 'smile', position: 'left' },
          { id: 'ghost', state: 'normal', position: 'right' },
        ]}
        speakerId="yuki"
      />,
    )

    const yuki = screen.getByTestId('stage-character-yuki')
    const ghost = screen.getByTestId('stage-character-ghost')
    expect(yuki).toHaveAttribute('data-framing', 'bust')
    expect(yuki).toHaveAttribute('data-speaker', 'true')
    expect(screen.getByAltText('雪')).toHaveAttribute('src', '/assets/characters/yuki_smile.png')
    expect(ghost).toHaveAttribute('data-framing', 'full')
    expect(ghost).toHaveAttribute('data-speaker', 'false')
    expect(yuki).toHaveClass('max-sm:!w-[88%]')
    expect(yuki).toHaveClass('max-sm:!left-1/2')
    expect(ghost).toHaveClass('max-sm:!opacity-0')
  })

  it('uses a supplied custom URL and exposes an unobtrusive fallback on load failure', () => {
    render(
      <StageCharacters
        mode="full"
        characters={[{ id: 'custom-hero', state: 'normal', position: 'center', customUrl: '/uploads/hero.png' }]}
        speakerId="custom-hero"
        resolveName={() => '自定义主角'}
      />,
    )

    const image = screen.getByAltText('自定义主角')
    expect(image).toHaveAttribute('src', '/uploads/hero.png')
    fireEvent.error(image)
    expect(screen.getByTestId('stage-character-custom-hero')).toHaveAttribute('data-load-error', 'true')
    expect(screen.getByText('立绘暂不可用')).toBeInTheDocument()
  })
})
