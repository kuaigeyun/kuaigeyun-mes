# Quotation Print Regression Baseline

This checklist is used for quotation (`document_type=quotation`) grayscale rollout.

## Sample data sets

1. **Minimal fields**: only mandatory quotation header + 1 line item.
2. **Long table**: 80+ line items to verify multipage table behavior.
3. **Chinese stress**: long Chinese customer/material names and notes.
4. **Numeric stress**: large currency values, zero values, and decimal values.
5. **Null/optional stress**: missing optional fields (`payment_terms`, `shipping_method`, `notes`).

## Validation matrix

### Rendering correctness

- [ ] Designer schema can be compiled (`/core/print-templates/compile`) without hard errors.
- [ ] Compiled template renders via `/core/print-templates/{uuid}/render`.
- [ ] Jinja2 filters (`money/date/number`) produce expected output.
- [ ] Plain engine templates continue rendering unchanged.

### Preview and print behavior

- [ ] Quotation print modal loads active templates with `document_type=quotation`.
- [ ] Variable preview endpoint (`/apps/kuaizhizao/quotations/{id}/print-variables`) returns expected keys.
- [ ] PDF preview opens and can be downloaded/printed.
- [ ] `record-print` endpoint is triggered after successful print preview generation.

### Chinese layout and pagination

- [ ] Chinese text is readable in PDF output.
- [ ] No severe overlap/truncation for long Chinese text.
- [ ] Multipage output remains stable with long item tables.
- [ ] Header/footer blocks keep expected spacing.

### Rollback safety

- [ ] Setting `config.engine=plain` immediately restores old rendering path.
- [ ] Existing non-quotation templates are unaffected.

