import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// mocks MUST be declared before importing the tested module
vi.mock('idb-keyval', () => ({ get: vi.fn(), set: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useParams: () => ({ id: 'story-1' }) }));

// lightweight component mocks so the page can render in isolation
vi.mock('@/components/admin-panel/content-layout', () => ({ ContentLayout: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/components/error-boundary', () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/context/moments-collection', () => ({ MomentsProvider: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/components/moments-grid', () => ({ default: () => <div data-testid="moments-grid" /> }));
vi.mock('@/components/collection-overlay', () => ({ default: () => null }));
vi.mock('@/components/ui/selection-header-bar', () => ({ SelectionHeaderBar: () => <div /> }));

import { get as idbGet, set as idbSet } from 'idb-keyval';
import useSelection from '@/hooks/use-selection';
import StoryPage from './page';

describe('Story page — title input', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // clear zustand selection store between tests
    useSelection.getState().clear();
  });

  it('preserves typed title when selection changes and saves on blur', async () => {
    // arrange: make `get` return stored story + stories metadata
    const getMock = vi.mocked(idbGet);
    const setMock = vi.mocked(idbSet);

    getMock.mockImplementation(async (key: string) => {
      if (key === 'story:story-1') return { title: 'Stored Title', items: [] };
      if (key === 'stories') return [{ id: 'story-1', title: 'Meta Title', count: 1 }];
      return null;
    });

    render(<StoryPage />);

    // wait for the stored title to load into the input
    const input = await screen.findByPlaceholderText('Add a title');
    await waitFor(() => expect((input as HTMLInputElement).value).toBe('Stored Title'));

    // user edits title
    await userEvent.clear(input);
    await userEvent.type(input, 'New title');
    expect((input as HTMLInputElement).value).toBe('New title');

    // trigger a selection-store change (this used to re-run the loader and overwrite the title)
    useSelection.getState().set('stories', ['m1']);

    // verify title was NOT overwritten
    expect((input as HTMLInputElement).value).toBe('New title');

    // blur to save — component should call idb-keyval.set for story and update stories metadata
    input.blur();

    await waitFor(() => {
      expect(setMock).toHaveBeenCalledWith('story:story-1', expect.objectContaining({ title: 'New title' }));
      expect(setMock).toHaveBeenCalledWith('stories', expect.arrayContaining([expect.objectContaining({ id: 'story-1', title: 'New title' })]));
    });
  });
});
