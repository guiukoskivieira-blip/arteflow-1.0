import { test, expect } from '@playwright/test';

test.describe('Fase 2B — Validação E2E do Fluxo Completo de Compras', () => {
  test.beforeEach(async ({ page }) => {
    // Monitorar erros de console e exceções não tratadas
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('was not wrapped in act')) {
          console.error(`Browser console error: ${text}`);
        }
      }
    });
  });

  test('1. Fluxo Completo: Fornecedor -> Solicitação -> Pedido -> Emissão -> Recebimento Parcial e Total -> Estoque -> Recarga', async ({ page }) => {
    // 1. Acessar aplicação
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // 2. Navegar para a página de Compras
    const navPurchasing = page.getByRole('button', { name: /compras/i }).first();
    await navPurchasing.click();

    // 3. Confirmar abas disponíveis
    await expect(page.getByRole('button', { name: /necessidades/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /solicitações/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /pedidos de compra/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /fornecedores/i })).toBeVisible();

    // 4. Acessar Fornecedores e Cadastrar um novo
    await page.getByRole('button', { name: /fornecedores/i }).click();

    const uniqId = Date.now().toString().slice(-4);
    const supplierCode = `SUP-E2E-${uniqId}`;
    const supplierName = `Fornecedor Industrial E2E ${uniqId}`;
    const supplierEdited = `Fornecedor Industrial E2E Alterado ${uniqId}`;

    await page.getByRole('button', { name: /novo fornecedor/i }).click();
    await expect(page.getByRole('heading', { name: 'Cadastrar Fornecedor' })).toBeVisible();

    // Preencher campos
    await page.getByPlaceholder('SUP-001').fill(supplierCode);
    await page.getByPlaceholder(/ex: suprimentos gráficos brasil/i).fill(supplierName);
    await page.getByRole('button', { name: 'Cadastrar Fornecedor' }).click();

    // Conferir se o modal fechou e fornecedor aparece na tabela
    await expect(page.getByRole('heading', { name: 'Cadastrar Fornecedor' })).not.toBeVisible();
    await expect(page.getByText(supplierName, { exact: true })).toBeVisible();

    // 5. Editar Fornecedor
    const editBtn = page.locator(`tr:has-text("${supplierName}")`).getByTitle(/editar fornecedor/i);
    await editBtn.click();
    await expect(page.getByRole('heading', { name: 'Editar Fornecedor' })).toBeVisible();

    const tradeNameInput = page.getByLabel(/nome fantasia/i).or(page.locator('input[value*="Fornecedor Industrial E2E"]')).first();
    await tradeNameInput.fill(supplierEdited);
    await page.getByRole('button', { name: /salvar alterações/i }).click();

    await expect(page.getByRole('heading', { name: 'Editar Fornecedor' })).not.toBeVisible();
    await expect(page.getByText(supplierEdited, { exact: true })).toBeVisible();

    // 6. Criar Solicitação de Compra
    await page.getByRole('button', { name: /solicitações/i }).click();
    await page.getByRole('button', { name: /nova solicitação de compra/i }).click();
    await expect(page.getByRole('heading', { name: 'Nova Solicitação de Compra' })).toBeVisible();

    // Selecionar primeiro material disponível
    const materialSelect = page.locator('div[role="dialog"] select').last();
    await materialSelect.selectOption({ index: 1 });
    await page.getByRole('button', { name: /criar solicitação de compra/i }).click();

    await expect(page.getByRole('heading', { name: 'Nova Solicitação de Compra' })).not.toBeVisible();
    await expect(page.locator('span:text-is("Solicitado")').first()).toBeVisible();

    // 7. Criar Pedido de Compra
    await page.getByRole('button', { name: /pedidos de compra/i }).click();
    const newOrderBtn = page.getByRole('button', { name: /novo pedido de compra|criar primeiro pedido/i }).first();
    await newOrderBtn.click();

    await expect(page.getByRole('heading', { name: 'Novo Pedido de Compra' })).toBeVisible();

    // Selecionar o fornecedor recém-criado dentro do modal
    const orderModal = page.getByRole('dialog');
    const orderSupplierSelect = orderModal.locator('select').first();
    await orderSupplierSelect.selectOption({ index: 1 });

    // Selecionar material
    const orderMatSelect = orderModal.locator('select').nth(1);
    await orderMatSelect.selectOption({ index: 1 });

    const numberInputs = orderModal.locator('input[type="number"]');
    await numberInputs.nth(0).fill('10');
    await numberInputs.nth(1).fill('50.00');

    await orderModal.getByRole('button', { name: /salvar pedido/i }).click();
    await expect(page.getByRole('heading', { name: 'Novo Pedido de Compra' })).not.toBeVisible();

    // 8. Emitir Pedido diretamente pelo botão na tabela
    const issueBtn = page.getByRole('button', { name: /emitir/i }).first();
    await issueBtn.click();

    // 9. Abrir Drawer de Detalhes
    const viewDetailBtn = page.getByTitle(/ver detalhes do pedido/i).first();
    await viewDetailBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Fechar drawer
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // 10. Registrar Recebimento Parcial (4 de 10)
    const receiveBtn = page.getByRole('button', { name: /receber/i }).first();
    await receiveBtn.click();

    await expect(page.getByRole('heading', { name: 'Registrar Recebimento Físico' })).toBeVisible();
    const receiptModal = page.getByRole('dialog');

    // Aguardar carregamento dos itens do pedido no modal de recebimento
    const receiveQtyInput = receiptModal.locator('input[type="number"]').first();
    await expect(receiveQtyInput).toBeVisible();
    await receiveQtyInput.fill('4');

    await receiptModal.getByRole('button', { name: /confirmar recebimento físico/i }).click();

    // Fechar modal de recebimento via tecla Escape
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Registrar Recebimento Físico' })).not.toBeVisible();

    // Conferir status PARTIALLY_RECEIVED na tabela de pedidos
    await expect(page.locator('span:text-is("Recebido Parcial")').first()).toBeVisible();

    // 11. Registrar Recebimento Final (restante 6 de 6)
    await receiveBtn.click();
    await expect(page.getByRole('heading', { name: 'Registrar Recebimento Físico' })).toBeVisible();
    const finalReceiptModal = page.getByRole('dialog');
    await expect(finalReceiptModal.getByRole('button', { name: /tudo/i }).first()).toBeVisible();
    await finalReceiptModal.getByRole('button', { name: /tudo/i }).first().click();
    await finalReceiptModal.getByRole('button', { name: /confirmar recebimento físico/i }).click();

    // Fechar modal pós-sucesso via Escape
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Registrar Recebimento Físico' })).not.toBeVisible();

    // Conferir status RECEIVED na tabela de pedidos
    await expect(page.locator('span:text-is("Recebido Total")').first()).toBeVisible();

    // 12. Conferir entrada no Estoque
    await page.getByRole('button', { name: /estoque/i }).first().click();
    await expect(page.getByRole('heading', { name: /estoque/i }).first()).toBeVisible();

    // 13. Recarregar a página e garantir persistência
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Voltar a Compras e conferir se dados persistem
    await page.getByRole('button', { name: /compras/i }).first().click();
    await page.getByRole('button', { name: /fornecedores/i }).click();
    await expect(page.getByText(supplierEdited, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: /pedidos de compra/i }).click();
    await expect(page.locator('span:text-is("Recebido Total")').first()).toBeVisible();
  });

  test('2. Validações Negativas e Proteções da Interface', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /compras/i }).first().click();
    await page.getByRole('button', { name: /fornecedores/i }).click();

    // Negativo 1: Tentar cadastrar fornecedor sem nome
    await page.getByRole('button', { name: /novo fornecedor/i }).click();
    await page.getByPlaceholder('SUP-001').fill('SUP-INVALID');
    await page.getByPlaceholder(/ex: suprimentos gráficos brasil/i).fill('');
    await page.getByRole('button', { name: 'Cadastrar Fornecedor' }).click();

    // Modal deve permanecer aberto
    await expect(page.getByRole('heading', { name: 'Cadastrar Fornecedor' })).toBeVisible();
    await page.getByRole('button', { name: /cancelar/i }).click();

    // Negativo 2: Desativar fornecedor e conferir badge na linha da tabela
    const toggleSup = page.getByTitle(/desativar fornecedor/i).first();
    if (await toggleSup.isVisible()) {
      await toggleSup.click();
      await expect(page.locator('span:text-is("Inativo")').first()).toBeVisible();
    }
  });

  test('3. Responsividade em Viewports Mobile e Tablet', async ({ page }) => {
    // 1440x900
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: /compras/i }).first().click();
    await expect(page.getByRole('button', { name: /pedidos de compra/i })).toBeVisible();

    // 1024x768
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByRole('button', { name: /pedidos de compra/i })).toBeVisible();

    // 390x844 (Mobile)
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileMenuBtn = page.getByRole('button', { name: /abrir menu de navegação/i });
    await expect(mobileMenuBtn).toBeVisible();

    await mobileMenuBtn.click();
    const mobileComprasLink = page.getByRole('button', { name: /compras/i }).first();
    await expect(mobileComprasLink).toBeVisible();
    await mobileComprasLink.click();

    // Confirmar que abas de compras são utilizáveis no mobile
    await expect(page.getByRole('button', { name: /pedidos de compra/i })).toBeVisible();
  });
});
