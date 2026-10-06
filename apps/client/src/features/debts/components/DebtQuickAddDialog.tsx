import { useState } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { DebtQuickCreateForm } from './DebtQuickCreateForm'
import { type Account, type Category, type Partner } from '@/hooks/useDebtsData'

type Props = {
  partners: Partner[]
  accounts: Account[]
  categories: Category[]
  defaultAccountId?: string | null
  defaultCurrency: string
}

export function DebtQuickAddDialog({ partners, accounts, categories, defaultAccountId, defaultCurrency }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Thêm nhanh khoản vay</p>
          <p className="text-xs text-muted-foreground">Mở modal để nhập thông tin và ghi nhận cashflow.</p>
        </div>
        <Button variant="default" onClick={() => setOpen(true)}>Thêm khoản vay</Button>
      </div>

      <Modal open={open} onOpenChange={setOpen} onClose={() => setOpen(false)} size="4xl" mode="create">
        <ModalHeader
          title="Khoản vay mới"
          description="Nhập thông tin, hệ thống sẽ tạo transaction cashflow tự động."
          onClose={() => setOpen(false)}
        />
        <ModalBody>
          <DebtQuickCreateForm
            partners={partners}
            accounts={accounts}
            categories={categories}
            defaultAccountId={defaultAccountId}
            defaultCurrency={defaultCurrency}
          />
        </ModalBody>
        <ModalFooter onClose={() => setOpen(false)} closeText="Đóng" />
      </Modal>
    </>
  )
}
