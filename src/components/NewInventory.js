import { EditOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Card, Input, Modal, Table, Tag, Typography } from "antd";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import moment from "moment";
import React, { useEffect, useState } from "react";
import { db } from "./firebase";
import Navbar from "./Navbar";
import { ITEM_PRICES } from "./PoolBillingSystem";

const { Title } = Typography;

const NewInventory = ({ selectedLocation, setSelectedLocation }) => {
  const [newHouseStock, setNewHouseStock] = useState({});
  const [initialStock, setInitialStock] = useState({}); // New state for initial stock
  const [showInitialStockModal, setShowInitialStockModal] = useState(false);
  const [showUpdateStockModal, setShowUpdateStockModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [initialStockInput, setInitialStockInput] = useState({});
  const [updateStockInput, setUpdateStockInput] = useState({});
  const [prevOrders, setPrevOrders] = useState({});
  const [selectedDate, setSelectedDate] = useState(
    moment().format("YYYY-MM-DD")
  );

  const saveInventory = async (inventory) => {
    await setDoc(doc(db, "inventory", "newHouseStock"), { data: inventory });
  };

  useEffect(() => {
    if (selectedLocation !== "New House Of Pool") return;
    const unsub = onSnapshot(
      doc(db, "inventory", "newHouseStock"),
      (docSnap) => {
        const inventory = docSnap.exists() ? docSnap.data().data : {};
        console.log("Firestore sync, inventory:", inventory);
        if (Object.keys(inventory).length === 0) {
          setShowInitialStockModal(true);
        } else {
          const initial = {};
          const current = {};
          Object.entries(inventory).forEach(([item, values]) => {
            initial[item] = values.initial || values.available; // Preserve initial stock
            current[item] = {
              available: values.available,
              sold: values.sold,
              initial: values.initial || values.available, // Ensure initial is set
            };
          });
          setInitialStock(initial);
          setNewHouseStock(current);
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

  // ✅ Save Initial Stock
  const saveInitialStock = async () => {
    const newStock = {};
    Object.keys(ITEM_PRICES).forEach((item) => {
      const initialQty = initialStockInput[item] || 0;
      newStock[item] = {
        initial: initialQty, // Store initial stock
        available: initialQty, // Set available to initial
        sold: 0,
      };
    });

    await saveInventory(newStock);
    setNewHouseStock(newStock);
    setInitialStock(
      Object.fromEntries(
        Object.entries(newStock).map(([item, values]) => [item, values.initial])
      )
    );
    setShowInitialStockModal(false);
  };

  // ✅ Reset Inventory
  const resetInventory = () => {
    console.log(
      "resetInventory clicked, current newHouseStock:",
      newHouseStock
    );
    setShowResetConfirmModal(true);
  };

  const confirmReset = () => {
    console.log("Reset confirmed, clearing newHouseStock");
    setNewHouseStock({}); // Clear current stock
    setInitialStock({}); // Clear initial stock
    setPrevOrders({});
    setShowInitialStockModal(true); // Prompt for new initial values
    setShowResetConfirmModal(false);
  };

  const cancelReset = () => {
    console.log("Reset canceled, newHouseStock should persist:", newHouseStock);
    setShowResetConfirmModal(false);
  };

  // ✅ Handle Inventory Update Input
  const handleUpdateStockChange = (item, value) => {
    setUpdateStockInput((prev) => ({
      ...prev,
      [item]: parseInt(value) || 0,
    }));
  };

  // ✅ Update Inventory Quantity
  const updateStock = async () => {
    const updatedStock = { ...newHouseStock };

    Object.entries(updateStockInput).forEach(([item, quantity]) => {
      if (updatedStock[item]) {
        updatedStock[item].available = Math.max(0, quantity);
        // Initial stock remains unchanged
      }
    });

    await saveInventory(updatedStock);
    setNewHouseStock(updatedStock);
    setShowUpdateStockModal(false);
  };

  // ✅ Stock Level Indicator
  const getStockTag = (quantity) => {
    if (quantity === 0) return <Tag color="red">Out of Stock</Tag>;
    if (quantity <= 3) return <Tag color="orange">Low Stock</Tag>;
    if (quantity <= 5) return <Tag color="gold">Limited</Tag>;
    return <Tag color="green">In Stock</Tag>;
  };

  // ✅ Table Columns
  const columns = [
    {
      title: "Item",
      dataIndex: "item",
      key: "item",
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: "Stock", // New column for initial stock
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
  ];

  if (selectedLocation !== "New House Of Pool") return null;

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
          🏪 New House Of Pool Inventory
        </Title>

        {/* Update Inventory Button */}
        <Button
          type="primary"
          icon={<EditOutlined />}
          onClick={() => setShowUpdateStockModal(true)}
          style={styles.updateButton}
        >
          Update Inventory
        </Button>

        {/* Reset Inventory Button */}
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          onClick={resetInventory}
          style={styles.resetButton}
        >
          Reset Inventory
        </Button>

        {/* Inventory Table */}
        <Table
          dataSource={
            newHouseStock
              ? Object.entries(newHouseStock).map(([item, values]) => ({
                  key: item,
                  item,
                  initial: values.initial, // New field for initial stock
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

        {/* Modal for Initial Stock Input */}
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
          {Object.keys(ITEM_PRICES).map((item) => (
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

        {/* Modal for Updating Inventory */}
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
          {Object.keys(newHouseStock).map((item) => (
            <div key={item} style={styles.modalInput}>
              <label>{item}:</label>
              <Input
                type="number"
                min="0"
                value={
                  updateStockInput[item] || newHouseStock[item]?.available || 0
                }
                onChange={(e) => handleUpdateStockChange(item, e.target.value)}
                placeholder="Enter new quantity"
                style={styles.inputField}
              />
            </div>
          ))}
        </Modal>
      </Card>
    </div>
  );
};

// ✅ Styles for UI
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

export default NewInventory;
