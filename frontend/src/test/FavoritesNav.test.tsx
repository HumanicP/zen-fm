import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { renderApp } from './renderApp'
import { server } from './server'

it('keeps favorites and draft labels when a save fails', async () => {
  const settings = { theme: 'system', locale: 'en', showHidden: false, clientTimeoutSeconds: 30, favorites: ['/Books'], favoriteLabels: { '/Books': 'Reading' } }
  const updates: unknown[] = []
  server.use(
    http.get('http://localhost/api/v1/settings', () => HttpResponse.json(settings)),
    http.put('http://localhost/api/v1/settings', async ({ request }) => {
      updates.push(await request.json())
      return HttpResponse.json({ detail: 'Could not save favorites' }, { status: 500 })
    }),
  )
  const user = userEvent.setup()
  renderApp('/files')
  await user.click(await screen.findByRole('button', { name: 'More favorites' }))
  const favorite = screen.getByRole('menuitem', { name: 'Reading /Books' })
  expect(favorite).toHaveAttribute('href', '/files/Books')
  fireEvent.contextMenu(favorite, { clientX: 200, clientY: 100 })
  await user.click(await screen.findByRole('menuitem', { name: 'Edit label' }))
  const label = screen.getByRole('textbox', { name: 'Label' })
  await user.clear(label)
  await user.type(label, 'New reading label')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByText('Could not save favorites')).toBeInTheDocument()
  expect(label).toHaveValue('New reading label')
  expect(updates).toEqual([{ favoriteLabels: { '/Books': 'New reading label' } }])
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

  await user.click(screen.getByRole('button', { name: 'More favorites' }))
  const unchanged = screen.getByRole('menuitem', { name: 'Reading /Books' })
  expect(unchanged).toHaveAttribute('href', '/files/Books')
  fireEvent.keyDown(unchanged, { key: 'ContextMenu' })
  await user.click(await screen.findByRole('menuitem', { name: 'Remove from favorites' }))
  await waitFor(() => expect(updates).toEqual([{ favoriteLabels: { '/Books': 'New reading label' } }, { favorites: [] }]))
  await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Remove from favorites' })).not.toHaveAttribute('aria-disabled', 'true'))
  await user.keyboard('{Escape}')
  await user.click(screen.getByRole('button', { name: 'More favorites' }))
  expect(screen.getByRole('menuitem', { name: 'Reading /Books' })).toHaveAttribute('href', '/files/Books')
})
