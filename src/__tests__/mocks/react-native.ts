export const Platform = {
  OS: "test",
  select: <T,>(options: { default?: T } & Record<string, T>) => options.default,
};
