export default (body) => {
  if (Symbol.asyncIterator in body) {
    return body;
  }
  const reader = body.getReader();
  return {
    [Symbol.asyncIterator]() {
      return {
        next: () => reader.read(),
      };
    },
  };
};
