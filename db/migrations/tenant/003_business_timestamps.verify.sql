SELECT (
  SELECT count(*) = 12
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN (
      'management_offices',
      'machine_types',
      'machines',
      'bases',
      'inspection_types',
      'inspection_schedules'
    )
    AND column_name IN ('created_at', 'updated_at')
) AS ok;
