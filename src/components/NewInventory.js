import { EditOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Card, Input, Modal, Table, Tag, Typography } from "antd";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import moment from "moment";
import React, { useEffect, useState } from "react";
import { db } from "./firebase";
import Navbar from "./Navbar";
import { ITEM_PRICES } from "./PoolBillingSystem";

const { Title } = Typography;

const NewInventory = ({ selectedLocation, setSelectedLocation }) => {
  const [newHouseStock, setnewHouseStock] = useState({});
  const [showInitialStockModal, setShowInitialStockModal] = useState(false);
  const [showUpdateStockModal, setShowUpdateStockModal] = useState(false);
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
        if (Object.keys(inventory).length === 0) {
          setShowInitialStockModal(true);
        } else {
          setnewHouseStock(inventory);
        }
      },
      (error) => {
        console.error("Firestore listener error:", error);
      }
    );
    return () => unsub(); // Cleanup listener on unmount
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
    // Include all items from ITEM_PRICES
    Object.keys(ITEM_PRICES).forEach((item) => {
      newStock[item] = {
        available: initialStockInput[item] || 0,
        sold: 0,
      };
    });

    await saveInventory(newStock);
    setnewHouseStock(newStock);
    setShowInitialStockModal(false);
  };

  // ✅ Reset Inventory
  const resetInventory = async () => {
    setShowInitialStockModal(true); // ✅ Ask for new stock values
    setnewHouseStock({});
    setPrevOrders({});
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
      }
    });

    await saveInventory(updatedStock);
    setnewHouseStock(updatedStock);
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
      title: "Available Quantity",
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
      title: "Sold Quantity",
      dataIndex: "sold",
      key: "sold",
      render: (quantity) => <Tag color="blue">{quantity}</Tag>,
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
          {Object.keys(ITEM_PRICES).map(
            (
              item // Changed from defaultItems
            ) => (
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
            )
          )}
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
                value={updateStockInput[item] || newHouseStock[item]?.available || 0}
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

export default NewInventory;

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
