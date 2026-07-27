-- DesignOS migration 003: add "Components" design type
-- Website/UI components saved as inspiration: buttons, cards, heroes,
-- pricing sections, nav bars, page layouts (21st.dev-style collecting).

insert into public.design_types (key, name, format_profile, sort_order) values
  ('component', 'Components',
   '{"notes":"A single component or section, not a whole surface. Judge it as a reusable part.","constraints":["self-contained: works out of visual context","all interaction states designed: default, hover, focus, active, disabled, loading where relevant","keyboard focus visible","responsive behavior defined (how it reflows, not just shrinks)","token-driven: colors/spacing/type from the system, no one-off values","accessible contrast in every state"]}',
   6);
