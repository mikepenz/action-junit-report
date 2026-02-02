// Types from @actions/core that are not exported in v3
export interface SummaryTableCell {
  data: string
  header?: boolean
  colspan?: string
  rowspan?: string
}

export type SummaryTableRow = (SummaryTableCell | string)[]
