import {
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Button, Card, Input, Modal, Table, Tag, Typography } from "antd";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import moment from "moment";
import React, { useEffect, useState } from "react";
import { db } from "./firebase";
import Navbar from "./Navbar";
import { getItemPrices } from "./PoolBillingSystem";

const { Title } = Typography;

// Default prices for initial items (can be overridden by Firestore)
const DEFAULT_ITEM_PRICES = {
  Lays: 20,
  Tin: 40,
  "KitKat (Small)": 35,
  "KitKat (Large)": 50,
  "Drinks (Glass)": 20,
  Water: 20,
};

const OldInventory = ({ selectedLocation, setSelectedLocation }) => {
  const [oldHouseStock, setOldHouseStock] = useState({});
  const [initialStock, setInitialStock] = useState({});
  const [showInitialStockModal, setShowInitialStockModal] = useState(false);
  const [showUpdateStockModal, setShowUpdateStockModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showRemoveConfirmModal, setShowRemoveConfirmModal] = useState(false);
  const [itemToRemove, setItemToRemove] = useState(null);
  const [initialStockInput, setInitialStockInput] = useState({});
  const [updateStockInput, setUpdateStockInput] = useState({});
  const [addItemInput, setAddItemInput] = useState({
    name: "",
    initial: "",
    price: "",
  }); // Added price field
  const [prevOrders, setPrevOrders] = useState({});
  const [selectedDate, setSelectedDate] = useState(
    moment().format("YYYY-MM-DD")
  );
  const [ITEM_PRICES, setITEM_PRICES] = useState({});

  useEffect(() => {
    const fetchPrices = async () => {
      const prices = await getItemPrices(selectedLocation);
      setITEM_PRICES(prices);
    };
    fetchPrices();
  }, [selectedLocation]);

  const saveInventory = async (inventory) => {
    await setDoc(doc(db, "inventory", "oldHouseStock"), { data: inventory });
  };

  useEffect(() => {
    if (selectedLocation !== "Old House Of Pool") return;
    const unsub = onSnapshot(
      doc(db, "inventory", "oldHouseStock"),
      (docSnap) => {
        const inventory = docSnap.exists() ? docSnap.data().data : {};
        console.log("Firestore sync, inventory:", inventory);
        if (Object.keys(inventory).length === 0) {
          setShowInitialStockModal(true);
        } else {
          const initial = {};
          const current = {};
          Object.entries(inventory).forEach(([item, values]) => {
            initial[item] = values.initial || values.available;
            current[item] = {
              available: values.available,
              sold: values.sold,
              initial: values.initial || values.available,
              price: values.price || DEFAULT_ITEM_PRICES[item] || 0, // Preserve price or default
            };
          });
          setInitialStock(initial);
          setOldHouseStock(current);
        }
      },
      (error) => {
        console.error("Firestore listener error:", error);
      }
    );
    return () => unsub();
  }, [selectedLocation]);

  const handleStockChange = (item, value) => {
    setInitialStockInput((prev) => ({
      ...prev,
      [item]: parseInt(value) || 0,
    }));
  };

  const saveInitialStock = async () => {
    const oldStock = {};
    Object.keys(DEFAULT_ITEM_PRICES).forEach((item) => {
      const initialQty = initialStockInput[item] || 0;
      oldStock[item] = {
        initial: initialQty,
        available: initialQty,
        sold: 0,
        price: DEFAULT_ITEM_PRICES[item], // Include default price
      };
    });

    await saveInventory(oldStock);
    setOldHouseStock(oldStock);
    setInitialStock(
      Object.fromEntries(
        Object.entries(oldStock).map(([item, values]) => [item, values.initial])
      )
    );
    setShowInitialStockModal(false);
  };

  const resetInventory = () => {
    console.log(
      "resetInventory clicked, current oldHouseStock:",
      oldHouseStock
    );
    setShowResetConfirmModal(true);
  };

  const confirmReset = () => {
    console.log("Reset confirmed, clearing oldHouseStock");
    setOldHouseStock({});
    setInitialStock({});
    setPrevOrders({});
    setShowInitialStockModal(true);
    setShowResetConfirmModal(false);
  };

  const cancelReset = () => {
    console.log("Reset canceled, oldHouseStock should persist:", oldHouseStock);
    setShowResetConfirmModal(false);
  };

  const handleUpdateStockChange = (item, value) => {
    setUpdateStockInput((prev) => ({
      ...prev,
      [item]: parseInt(value) || 0,
    }));
  };

  const updateStock = async () => {
    const updatedStock = { ...oldHouseStock };

    Object.entries(updateStockInput).forEach(([item, quantity]) => {
      if (updatedStock[item]) {
        updatedStock[item].available = Math.max(0, quantity);
      }
    });

    await saveInventory(updatedStock);
    setOldHouseStock(updatedStock);
    setShowUpdateStockModal(false);
  };

  const handleAddItemChange = (field, value) => {
    setAddItemInput((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const addItem = async () => {
    const { name, initial, price } = addItemInput;
    if (!name || !initial || !price) {
      alert("Please enter item name, initial stock, and price.");
      return;
    }
    const initialQty = parseInt(initial) || 0;
    const itemPrice = parseFloat(price) || 0;
    const updatedStock = {
      ...oldHouseStock,
      [name]: {
        initial: initialQty,
        available: initialQty,
        sold: 0,
        price: itemPrice, // Store the price
      },
    };

    await saveInventory(updatedStock);
    setOldHouseStock(updatedStock);
    setInitialStock((prev) => ({
      ...prev,
      [name]: initialQty,
    }));
    setShowAddItemModal(false);
    setAddItemInput({ name: "", initial: "", price: "" });
  };

  const promptRemoveItem = (item) => {
    setItemToRemove(item);
    setShowRemoveConfirmModal(true);
  };

  const confirmRemoveItem = async () => {
    if (!itemToRemove) return;
    const updatedStock = { ...oldHouseStock };
    delete updatedStock[itemToRemove];
    await saveInventory(updatedStock);
    setOldHouseStock(updatedStock);
    setInitialStock((prev) => {
      const newInitial = { ...prev };
      delete newInitial[itemToRemove];
      return newInitial;
    });
    setShowRemoveConfirmModal(false);
    setItemToRemove(null);
  };

  const cancelRemoveItem = () => {
    setShowRemoveConfirmModal(false);
    setItemToRemove(null);
  };

  const getStockTag = (quantity) => {
    if (quantity === 0) return <Tag color="red">Out of Stock</Tag>;
    if (quantity <= 3) return <Tag color="orange">Low Stock</Tag>;
    if (quantity <= 5) return <Tag color="gold">Limited</Tag>;
    return <Tag color="green">In Stock</Tag>;
  };

  const columns = [
    {
      title: "Item",
      dataIndex: "item",
      key: "item",
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: "Stock",
      dataIndex: "initial",
      key: "initial",
      render: (quantity) => <Tag color="purple">{quantity}</Tag>,
    },
    {
      title: "Sales Stock",
      dataIndex: "sold",
      key: "sold",
      render: (quantity) => <Tag color="blue">{quantity}</Tag>,
    },
    {
      title: "Closing Stock",
      dataIndex: "available",
      key: "available",
      render: (quantity) => (
        <>
          <span
            style={{
              fontWeight: "bold",
              color:
                quantity === 0 ? "red" : quantity <= 3 ? "orange" : "black",
            }}
          >
            {quantity}
          </span>
          {getStockTag(quantity)}
        </>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Button
          type="link"
          icon={<DeleteOutlined />}
          onClick={() => promptRemoveItem(record.item)}
          danger
        >
          Remove
        </Button>
      ),
    },
  ];

  if (selectedLocation !== "Old House Of Pool") return null;

  return (
    <div>
      <Navbar
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        selectedLocation={selectedLocation}
        setSelectedLocation={setSelectedLocation}
      />
      <Card style={styles.card}>
        <Title level={3} style={styles.title}>
          🏪 Old House Of Pool Inventory
        </Title>

        <Button
          type="primary"
          icon={<EditOutlined />}
          onClick={() => setShowUpdateStockModal(true)}
          style={styles.updateButton}
        >
          Update Inventory
        </Button>

        <Button
          type="primary"
          icon={<ReloadOutlined />}
          onClick={resetInventory}
          style={styles.resetButton}
        >
          Reset Inventory
        </Button>

        <Button
          type="primary"
          onClick={() => setShowAddItemModal(true)}
          style={{
            ...styles.updateButton,
            backgroundColor: "#52c41a",
            borderColor: "#52c41a",
            margin: "10px",
          }}
        >
          Add Items
        </Button>

        <Table
          dataSource={
            oldHouseStock
              ? Object.entries(oldHouseStock).map(([item, values]) => ({
                  key: item,
                  item,
                  initial: values.initial,
                  available: values.available,
                  sold: values.sold,
                }))
              : []
          }
          columns={columns}
          bordered
          pagination={false}
          style={styles.table}
        />

        <Modal
          title="Confirm Reset"
          open={showResetConfirmModal}
          onOk={confirmReset}
          onCancel={cancelReset}
          okText="Yes"
          okButtonProps={{ danger: true }}
          cancelText="No"
        >
          <p>
            Are you sure you want to reset the inventory? This action will clear
            all current stock data and prompt for new initial values.
          </p>
        </Modal>

        <Modal
          title="Set Initial Stock"
          open={showInitialStockModal}
          onOk={saveInitialStock}
          onCancel={() => setShowInitialStockModal(false)}
          footer={[
            <Button
              key="cancel"
              onClick={() => setShowInitialStockModal(false)}
            >
              Cancel
            </Button>,
            <Button key="save" type="primary" onClick={saveInitialStock}>
              Save
            </Button>,
          ]}
        >
          {Object.keys(DEFAULT_ITEM_PRICES).map((item) => (
            <div key={item} style={styles.modalInput}>
              <label>{item}:</label>
              <Input
                type="number"
                min="0"
                value={initialStockInput[item] || ""}
                onChange={(e) => handleStockChange(item, e.target.value)}
                placeholder="Enter initial quantity"
                style={styles.inputField}
              />
            </div>
          ))}
        </Modal>

        <Modal
          title="Update Inventory"
          open={showUpdateStockModal}
          onOk={updateStock}
          onCancel={() => setShowUpdateStockModal(false)}
          footer={[
            <Button key="cancel" onClick={() => setShowUpdateStockModal(false)}>
              Cancel
            </Button>,
            <Button key="save" type="primary" onClick={updateStock}>
              Save Changes
            </Button>,
          ]}
        >
          {Object.keys(oldHouseStock).map((item) => (
            <div key={item} style={styles.modalInput}>
              <label>{item}:</label>
              <Input
                type="number"
                min="0"
                value={
                  updateStockInput[item] || oldHouseStock[item]?.available || 0
                }
                onChange={(e) => handleUpdateStockChange(item, e.target.value)}
                placeholder="Enter new quantity"
                style={styles.inputField}
              />
            </div>
          ))}
        </Modal>

        <Modal
          title="Add New Item"
          open={showAddItemModal}
          onOk={addItem}
          onCancel={() => setShowAddItemModal(false)}
          footer={[
            <Button key="cancel" onClick={() => setShowAddItemModal(false)}>
              Cancel
            </Button>,
            <Button key="save" type="primary" onClick={addItem}>
              Add
            </Button>,
          ]}
        >
          <div style={styles.modalInput}>
            <label>Item Name:</label>
            <Input
              value={addItemInput.name}
              onChange={(e) => handleAddItemChange("name", e.target.value)}
              placeholder="Enter item name"
              style={styles.inputField}
            />
          </div>
          <div style={styles.modalInput}>
            <label>Initial Stock:</label>
            <Input
              type="number"
              min="0"
              value={addItemInput.initial}
              onChange={(e) => handleAddItemChange("initial", e.target.value)}
              placeholder="Enter initial quantity"
              style={styles.inputField}
            />
          </div>
          <div style={styles.modalInput}>
            <label>Price (Rs):</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={addItemInput.price}
              onChange={(e) => handleAddItemChange("price", e.target.value)}
              placeholder="Enter price"
              style={styles.inputField}
            />
          </div>
        </Modal>

        <Modal
          title="Confirm Removal"
          open={showRemoveConfirmModal}
          onOk={confirmRemoveItem}
          onCancel={cancelRemoveItem}
          okText="Yes"
          okButtonProps={{ danger: true }}
          cancelText="No"
        >
          <p>
            Are you sure you want to remove the item "{itemToRemove}" from the
            inventory?
          </p>
        </Modal>
      </Card>
    </div>
  );
};

const styles = {
  card: {
    margin: "20px",
    padding: "20px",
    borderRadius: "10px",
    boxShadow: "0px 4px 10px rgba(0,0,0,0.1)",
    background: "#ffffff",
  },
  title: {
    textAlign: "center",
    color: "#1890ff",
  },
  updateButton: {
    marginBottom: "15px",
    backgroundColor: "#1890ff",
    borderColor: "#1890ff",
    marginRight: "10px",
  },
  resetButton: {
    marginBottom: "15px",
    backgroundColor: "#ff4d4f",
    borderColor: "#ff4d4f",
  },
  table: {
    marginTop: "10px",
    borderRadius: "8px",
    overflow: "hidden",
  },
  modalInput: {
    marginBottom: "10px",
  },
  inputField: {
    width: "100%",
    marginTop: "5px",
  },
};

// Function to get current inventory items and prices
export const getInventoryItems = async () => {
  const docSnap = await onSnapshot(
    doc(db, "inventory", "oldHouseStock"),
    (docSnap) => {
      const inventory = docSnap.exists() ? docSnap.data().data : {};
      const items = {};
      Object.entries(inventory).forEach(([item, values]) => {
        items[item] = values.price || DEFAULT_ITEM_PRICES[item] || 0;
      });
      return { ...DEFAULT_ITEM_PRICES, ...items };
    }
  );
  return docSnap;
};

export default OldInventory;
