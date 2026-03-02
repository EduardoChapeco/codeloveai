CREATE OR REPLACE FUNCTION public.validate_cirius_project_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status NOT IN ('draft', 'generating_prd', 'generating_code', 'refining', 'deploying', 'live', 'failed', 'paused') THEN
    RAISE EXCEPTION 'Invalid cirius project status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$function$;