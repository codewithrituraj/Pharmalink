import { H1RegisterTable } from "@/components/h1-register-table"

export default function StockistH1RegisterPage() {
  return <H1RegisterTable apiPath="/api/stockist/h1-register" exportPath="/api/stockist/h1-register/export" />
}