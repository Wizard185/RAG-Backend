export const getHealthStatus = () => {
  return {
    status: "ok",
    service: "RAG Knowledge Platform",
    timestamp: new Date().toISOString()
  };
};
