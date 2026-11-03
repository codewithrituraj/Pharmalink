import { H1RegisterTable } from "@/components/h1-register-table"

export default function AdminH1RegisterPage() {
  return <H1RegisterTable apiPath="/api/admin/h1-register" exportPath="/api/admin/h1-register/export" />
}