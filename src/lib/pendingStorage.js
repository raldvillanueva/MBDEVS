export function getPendingOrders() {
  const data = localStorage.getItem("pendingOrders")

  return data ? JSON.parse(data) : []
}


export function addPendingOrders(orders) {

  const existing = getPendingOrders()

  const updated = [
    ...existing,
    ...orders
  ]

  localStorage.setItem(
    "pendingOrders",
    JSON.stringify(updated)
  )

}


export function removePendingOrder(id) {

  const existing = getPendingOrders()

  const updated = existing.filter(
    item => item.id !== id
  )

  localStorage.setItem(
    "pendingOrders",
    JSON.stringify(updated)
  )

}