SELECT (
  SELECT count(*) = 9
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (
      (table_name = 'machines' AND column_name IN (
        'machine_number',
        'office_id',
        'type_certification',
        'manufacture_date',
        'purchase_date',
        'notes'
      ))
      OR (table_name = 'bases' AND column_name = 'location')
      OR (table_name = 'inspection_types' AND column_name IN ('display_order', 'is_active'))
    )
) AS ok;
