import { render, screen } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { ToastProvider, ToastContainer, showGlobalToast } from './ToastContext';

function renderWithToasts(ui: React.ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('ToastContext global toasts', () => {
  it('shows error toast when showGlobalToast is called', async () => {
    renderWithToasts(<ToastContainer />);

    const message = 'Тестовая ошибка';
    await act(async () => {
      showGlobalToast(message, 'error');
    });

    expect(await screen.findByText(message)).toBeInTheDocument();
  });
});

