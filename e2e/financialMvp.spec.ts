import { expect, Page, test } from '@playwright/test';

const CUSTOMER = 'Cliente Demonstração Financeira';
const PRODUCT = 'Produto Demonstrativo Financeiro';

type FinancialSnapshot = {
  orderId: string;
  orderNumber: string;
  jobCode: string;
  financialGate: string;
  receivableCount: number;
  paymentCount: number;
};

async function openSection(page: Page, name: 'Financeiro' | 'Produção') {
  if (await page.getByRole('button', { name: 'Abrir menu de navegação' }).isVisible()) {
    await page.getByRole('button', { name: 'Abrir menu de navegação' }).click();
  }
  await page.getByRole('button', { name: name === 'Produção' ? /^Produção/ : name }).click();
}

async function readFinancialSnapshot(page: Page): Promise<FinancialSnapshot> {
  return page.evaluate(({ customer }) => {
    const prefix = 'arteflow:v1:org-demo-grafica';
    const orders = JSON.parse(localStorage.getItem(`${prefix}:orders`) ?? '[]');
    const jobs = JSON.parse(localStorage.getItem(`${prefix}:jobs`) ?? '[]');
    const receivables = JSON.parse(localStorage.getItem(`${prefix}:receivables`) ?? '[]');
    const payments = JSON.parse(localStorage.getItem(`${prefix}:receivable_payments`) ?? '[]');
    const order = orders.find((candidate: { customer?: { name?: string } }) => candidate.customer?.name === customer);
    if (!order) throw new Error('Pedido demonstrativo financeiro não encontrado.');
    const job = jobs.find((candidate: { orderId: string }) => candidate.orderId === order.id);
    const linkedReceivables = receivables.filter((candidate: { orderId: string }) => candidate.orderId === order.id);
    const receivableIds = new Set(linkedReceivables.map((candidate: { id: string }) => candidate.id));
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      jobCode: job?.jobCode ?? '',
      financialGate: job?.financialGate ?? '',
      receivableCount: linkedReceivables.length,
      paymentCount: payments.filter((candidate: { receivableId: string }) => receivableIds.has(candidate.receivableId)).length,
    };
  }, { customer: CUSTOMER });
}

async function openPayment(page: Page) {
  const row = page.getByRole('row').filter({ hasText: CUSTOMER });
  await row.getByRole('button', { name: 'Registrar pagamento' }).click();
  return page.getByRole('form', { name: 'Registrar pagamento' });
}

test('fluxo financeiro completo mantém cobrança única e libera a OP somente após quitação', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Novo Pedido' })).toBeVisible();

  await page.getByRole('button', { name: 'Novo Pedido' }).click();
  const orderModal = page.getByTestId('new-order-modal');
  await orderModal.getByPlaceholder('Ex: Alfa Comunicação & Eventos').fill(CUSTOMER);
  await orderModal.locator('input[type="date"]').first().fill('2099-12-31');
  await orderModal.getByPlaceholder('Ex: Cartão de Visita 4x4 Couché 300g').fill(PRODUCT);
  await orderModal.getByPlaceholder('0,00').fill('100,00');
  await orderModal.getByRole('button', { name: 'Salvar Pedido & Gerar OPs' }).click();
  await expect(orderModal).toBeHidden();

  await openSection(page, 'Financeiro');
  await expect(page.getByTestId('financial-page')).toBeVisible();
  for (const indicator of ['Total a receber', 'Total recebido', 'Total vencido', 'Saldo em aberto', 'Contas pendentes']) {
    await expect(page.getByText(indicator, { exact: true })).toBeVisible();
  }

  const initial = await readFinancialSnapshot(page);
  expect(initial.receivableCount).toBe(1);
  expect(initial.paymentCount).toBe(0);
  expect(initial.financialGate).toBe('PAYMENT_PENDING');
  const accountRow = page.getByRole('row').filter({ hasText: CUSTOMER });
  await expect(accountRow).toContainText(initial.orderNumber);
  await expect(accountRow).toContainText('Pendente');

  let form = await openPayment(page);
  await form.getByPlaceholder('0,00').fill('0');
  await form.getByRole('button', { name: 'Confirmar pagamento' }).click();
  await expect(form.getByRole('alert')).toHaveText('Informe um valor positivo válido.');
  await form.getByRole('button', { name: 'Fechar' }).click();

  form = await openPayment(page);
  await form.getByPlaceholder('0,00').fill('100,01');
  await form.getByRole('button', { name: 'Confirmar pagamento' }).click();
  await expect(form.getByRole('alert')).toHaveText('O pagamento não pode superar o saldo em aberto.');
  await form.getByRole('button', { name: 'Fechar' }).click();

  form = await openPayment(page);
  await form.getByPlaceholder('0,00').fill('40,00');
  await form.getByRole('button', { name: 'Confirmar pagamento' }).click();
  await expect(form).toBeHidden();
  await expect(accountRow).toContainText('Parcial');
  expect((await readFinancialSnapshot(page)).financialGate).toBe('PAYMENT_PENDING');

  await openSection(page, 'Produção');
  const pendingCard = page.locator('div.rounded-xl').filter({ hasText: initial.jobCode }).filter({ hasText: 'Pgto Pendente' }).first();
  await expect(pendingCard).toBeVisible();

  await page.reload();
  await openSection(page, 'Financeiro');
  await page.getByLabel('Buscar contas').fill(CUSTOMER);
  await expect(page.getByRole('row').filter({ hasText: CUSTOMER })).toContainText('Parcial');
  const afterPartialReload = await readFinancialSnapshot(page);
  expect(afterPartialReload.receivableCount).toBe(1);
  expect(afterPartialReload.paymentCount).toBe(1);
  expect(afterPartialReload.financialGate).toBe('PAYMENT_PENDING');

  form = await openPayment(page);
  await form.getByPlaceholder('0,00').fill('60,00');
  await form.getByRole('button', { name: 'Confirmar pagamento' }).click();
  await expect(form).toBeHidden();
  await expect(page.getByRole('row').filter({ hasText: CUSTOMER })).toContainText('Pago');
  expect((await readFinancialSnapshot(page)).financialGate).toBe('RELEASED');

  await openSection(page, 'Produção');
  const releasedCard = page.locator('div.rounded-xl').filter({ hasText: initial.jobCode }).filter({ hasText: 'Liberado' }).first();
  await expect(releasedCard).toBeVisible();

  await page.reload();
  await openSection(page, 'Financeiro');
  await page.getByLabel('Buscar contas').fill(CUSTOMER);
  await expect(page.getByRole('row').filter({ hasText: CUSTOMER })).toContainText('Pago');
  const finalSnapshot = await readFinancialSnapshot(page);
  expect(finalSnapshot.receivableCount).toBe(1);
  expect(finalSnapshot.paymentCount).toBe(2);
  expect(finalSnapshot.financialGate).toBe('RELEASED');
});

test('Financeiro permanece utilizável em desktop e mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await openSection(page, 'Financeiro');
  await expect(page.getByTestId('financial-page')).toBeVisible();
  await expect(page.getByLabel('Buscar contas')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await openSection(page, 'Financeiro');
  await expect(page.getByTestId('financial-page')).toBeVisible();
  await expect(page.getByLabel('Buscar contas')).toBeVisible();
  await expect(page.getByText('Contas pendentes', { exact: true })).toBeVisible();
});
